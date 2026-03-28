import Anthropic from "@anthropic-ai/sdk"
import { getRecentCommits, getRepoTree, readRepoFile } from "@/lib/juno/github-repo"
import { getGithubAccountId } from "@/lib/juno/pipedream-github"
import { resolveGithubRepoFromProfile } from "@/lib/juno/security-scan-profile"
import {
  buildSecurityScanPrompt,
  normalizeFindingForDb,
  parseSecurityFindingsJson,
  selectFiles,
  type RawSecurityFinding,
} from "@/lib/juno/security-scanner"
import { inngest } from "@/lib/inngest/client"
import { supabaseAdmin } from "@/lib/supabase"

const anthropic = new Anthropic()

type ScanEvent = {
  userId: string
  repo: string
  branch: string
  mode?: "daily" | "comprehensive"
}

export const securityScanFanOut = inngest.createFunction(
  {
    id: "cto-security-scan-fanout",
    name: "CTO: Security Scan Fan-Out",
    triggers: [{ cron: "0 7 * * *" }],
  },
  async ({ step }) => {
    const rows = await step.run("load-users", async () => {
      const { data, error } = await supabaseAdmin
        .from("company_profile")
        .select(
          "user_id, github_repo, github_branch, github_vault_owner, github_vault_repo, github_vault_branch",
        )

      if (error) {
        console.error("[security-scan fanout]", error.message)
        return [] as Array<{ user_id: string; repo: string; branch: string }>
      }

      const out: Array<{ user_id: string; repo: string; branch: string }> = []
      for (const row of data ?? []) {
        const resolved = resolveGithubRepoFromProfile({
          github_repo: row.github_repo as string | null,
          github_branch: row.github_branch as string | null,
          github_vault_owner: row.github_vault_owner as string | null,
          github_vault_repo: row.github_vault_repo as string | null,
          github_vault_branch: row.github_vault_branch as string | null,
        })
        if (resolved) {
          out.push({ user_id: row.user_id as string, repo: resolved.repo, branch: resolved.branch })
        }
      }
      return out
    })

    if (rows.length > 0) {
      await step.sendEvent(
        "fan-out-security-scan",
        rows.map((u) => ({
          name: "juno/security-scan.requested" as const,
          data: {
            userId: u.user_id,
            repo: u.repo,
            branch: u.branch,
            mode: "daily" as const,
          },
        })),
      )
    }

    return { users: rows.length }
  },
)

export const securityScan = inngest.createFunction(
  {
    id: "cto-security-scan",
    name: "CTO: Security Scan",
    retries: 1,
    concurrency: { limit: 2 },
    triggers: [{ event: "juno/security-scan.requested" }],
  },
  async ({ event, step }) => {
    const { userId, repo, branch, mode = "daily" } = event.data as ScanEvent
    const scanId = crypto.randomUUID()

    const accountId = await step.run("resolve-github-account", () => getGithubAccountId(userId))
    if (!accountId) {
      await step.run("record-failed-no-account", async () => {
        await supabaseAdmin.from("security_scans").insert({
          user_id: userId,
          scan_id: scanId,
          repo,
          branch,
          mode,
          status: "failed",
          error_message: "No GitHub account linked in Pipedream Connect. Connect GitHub under Integrations.",
        })
      })
      return { scanId, status: "failed", reason: "no_github_account" }
    }

    const tree = await step.run("get-tree", () => getRepoTree(userId, accountId, repo, branch))
    if (tree.length === 0) {
      await step.run("record-failed-empty-tree", async () => {
        await supabaseAdmin.from("security_scans").insert({
          user_id: userId,
          scan_id: scanId,
          repo,
          branch,
          mode,
          status: "failed",
          error_message: "Empty repo tree (check repo name, branch, or GitHub access).",
        })
      })
      return { scanId, status: "failed", reason: "empty_tree" }
    }

    const selectedPaths = await step.run("select-files", () => selectFiles(tree))

    const files = await step.run("read-files", async () => {
      const contents: Array<{ path: string; content: string }> = []
      for (const path of selectedPaths) {
        const content = await readRepoFile(userId, accountId, repo, path, branch)
        if (content) contents.push({ path, content })
      }
      return contents
    })

    const commits = await step.run("get-commits", () =>
      getRecentCommits(userId, accountId, repo, branch, 30),
    )

    const findings = await step.run("analyse", async (): Promise<RawSecurityFinding[]> => {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.warn("[security-scan] ANTHROPIC_API_KEY missing")
        return []
      }
      const prompt = buildSecurityScanPrompt(files, tree, commits, repo, mode)
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      })
      const text = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("")
      return parseSecurityFindingsJson(text)
    })

    const dedup = await step.run("dedup-and-save", async () => {
      const { data: existing } = await supabaseAdmin
        .from("security_findings")
        .select("id, title, file_path, fingerprint, status")
        .eq("user_id", userId)
        .eq("status", "open")

      const existingRows = existing ?? []
      const existingFingerprints = new Set(
        existingRows.map((e) => e.fingerprint || `${e.title}:${e.file_path}`),
      )

      let newCount = 0
      for (const raw of findings) {
        const row = normalizeFindingForDb(raw, scanId, userId)
        const fp = row.fingerprint

        if (existingFingerprints.has(fp)) {
          existingFingerprints.delete(fp)
          continue
        }

        const { error } = await supabaseAdmin.from("security_findings").insert(row)
        if (!error) newCount++
        else if (error.code === "23505") {
          /* duplicate fingerprint */
        } else {
          console.error("[security-scan] insert finding:", error.message)
        }
      }

      let resolvedCount = 0
      for (const fp of existingFingerprints) {
        const match = existingRows.find((e) => (e.fingerprint || `${e.title}:${e.file_path}`) === fp)
        if (match?.id) {
          const { error } = await supabaseAdmin
            .from("security_findings")
            .update({
              status: "auto_resolved",
              resolved_at: new Date().toISOString(),
              resolution_notes: `Not detected in scan ${scanId}`,
            })
            .eq("id", match.id)
            .eq("user_id", userId)
          if (!error) resolvedCount++
        }
      }

      return { newFindings: newCount, resolvedCount }
    })

    await step.run("record-scan", async () => {
      await supabaseAdmin.from("security_scans").insert({
        user_id: userId,
        scan_id: scanId,
        repo,
        branch,
        mode,
        status: "completed",
        files_scanned: files.length,
        total_findings: findings.length,
        new_findings: dedup.newFindings,
        resolved_count: dedup.resolvedCount,
      })
    })

    await step.run("alert-critical", async () => {
      const critical = findings.filter(
        (f) => (f.severity || "").toUpperCase() === "CRITICAL" || (f.severity || "").toUpperCase() === "HIGH",
      )
      if (critical.length === 0) return
      const { data: profile } = await supabaseAdmin
        .from("company_profile")
        .select("whatsapp_number")
        .eq("user_id", userId)
        .maybeSingle()
      const num = profile?.whatsapp_number as string | undefined
      if (!num?.trim()) return
      // WhatsApp outbound not wired in this codebase; log for ops / future Twilio hook.
      console.warn(
        `[security-scan] ${critical.length} critical/high for user ${userId}; WhatsApp notify skipped (no sender).`,
      )
    })

    return {
      scanId,
      repo,
      mode,
      filesScanned: files.length,
      totalFindings: findings.length,
      newFindings: dedup.newFindings,
      resolvedCount: dedup.resolvedCount,
      critical: findings.filter((f) => (f.severity || "").toUpperCase() === "CRITICAL").length,
      high: findings.filter((f) => (f.severity || "").toUpperCase() === "HIGH").length,
      medium: findings.filter((f) => (f.severity || "").toUpperCase() === "MEDIUM").length,
    }
  },
)

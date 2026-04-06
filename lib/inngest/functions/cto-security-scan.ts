import { getDefaultModelId, getLlmBaseUrl, isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { generateText } from "ai"
import {
  getRecentCommits,
  getRepoTreeWithDiagnostics,
  readRepoFile,
  splitGithubRepo,
  treeEntriesFromGithubTreeRaw,
} from "@/lib/juno/github-repo"
import { resolveGithubRepoFromProfile } from "@/lib/juno/security-scan-profile"
import {
  buildSecurityScanPrompt,
  normalizeFindingForDb,
  parseSecurityFindingsJson,
  selectFiles,
  type RawSecurityFinding,
} from "@/lib/juno/security-scanner"
import { JUNO_SECURITY_SCAN_REQUESTED } from "@/lib/inngest/event-names"
import { inngest } from "@/lib/inngest/client"
import { supabaseAdmin } from "@/lib/supabase"

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
          name: JUNO_SECURITY_SCAN_REQUESTED,
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

/** LLM call must not hang indefinitely (huge prompts + slow providers caused 1h+ Inngest runs). */
const SECURITY_SCAN_LLM_TIMEOUT_MS = 15 * 60 * 1000

export const securityScan = inngest.createFunction(
  {
    id: "cto-security-scan",
    name: "CTO: Security Scan",
    retries: 1,
    concurrency: { limit: 2 },
    triggers: [{ event: JUNO_SECURITY_SCAN_REQUESTED }],
    timeouts: { finish: "32m" },
  },
  async ({ event, step }) => {
    const { userId, repo, branch, mode = "daily" } = event.data as ScanEvent
    const scanId = crypto.randomUUID()

    try {
      const accountId = await step.run("resolve-github-account", async () => {
        if (process.env.GITHUB_PAT?.trim()) {
          console.log("[security-scan] GITHUB_PAT set - using direct GitHub API for tree/files/commits")
          return "__github_pat__"
        }
        return null
      })

      if (!accountId) {
        await step.run("record-failed-no-account", async () => {
          await supabaseAdmin.from("security_scans").insert({
            user_id: userId,
            scan_id: scanId,
            repo,
            branch,
            mode,
            status: "failed",
            error_message:
              "Set GITHUB_PAT on the server (classic token with repo scope) so Juno can read the repository.",
          })
        })
        return { scanId, status: "failed", reason: "no_github_account" }
      }

      const treeResult = await step.run("get-tree", async () => {
        const pat = process.env.GITHUB_PAT?.trim()
        if (pat) {
          console.log("[security-scan] Using GITHUB_PAT directly, prefix:", pat.substring(0, 10))
          const parsed = splitGithubRepo(repo)
          if (parsed) {
            const { owner, name } = parsed
            const base = `https://api.github.com/repos/${owner}/${name}`
            const refUrl = `${base}/git/ref/heads/${encodeURIComponent(branch)}`
            const res = await fetch(refUrl, {
              headers: {
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                Authorization: `token ${pat}`,
              },
            })
            console.log("[security-scan] GitHub ref response status:", res.status)
            if (res.ok) {
              const data = (await res.json()) as { object?: { sha?: string } }
              const commitSha = data?.object?.sha
              if (commitSha) {
                const commitRes = await fetch(`${base}/git/commits/${commitSha}`, {
                  headers: {
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    Authorization: `token ${pat}`,
                  },
                })
                console.log("[security-scan] GitHub commit response status:", commitRes.status)
                if (commitRes.ok) {
                  const commitData = (await commitRes.json()) as { tree?: { sha?: string } }
                  const treeSha = commitData?.tree?.sha
                  if (treeSha) {
                    const treeRes = await fetch(`${base}/git/trees/${treeSha}?recursive=1`, {
                      headers: {
                        Accept: "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                        Authorization: `token ${pat}`,
                      },
                    })
                    console.log("[security-scan] GitHub tree response status:", treeRes.status)
                    if (treeRes.ok) {
                      const treeData = (await treeRes.json()) as {
                        tree?: Array<{ path?: string; size?: number; type?: string }>
                      }
                      const raw = treeData.tree ?? []
                      const shaped = treeEntriesFromGithubTreeRaw(raw, repo, branch)
                      console.log(
                        "[security-scan] Tree response:",
                        JSON.stringify(shaped).substring(0, 500),
                      )
                      return shaped
                    }
                    const body = await treeRes.text()
                    console.log("[security-scan] GitHub tree error:", body.substring(0, 200))
                  }
                }
              }
            } else {
              const body = await res.text()
              console.log("[security-scan] GitHub ref error:", body.substring(0, 200))
            }
          }
        }

        const result = await getRepoTreeWithDiagnostics(userId, accountId, repo, branch)
        console.log("[security-scan] Tree response:", JSON.stringify(result).substring(0, 500))
        return result
      })

      const { entries: tree, diagnostic } = treeResult
      if (tree.length === 0) {
        const message =
          diagnostic ??
          "Empty repo tree (check repo name, branch, and that GITHUB_PAT can access the repo)."
        await step.run("record-failed-empty-tree", async () => {
          await supabaseAdmin.from("security_scans").insert({
            user_id: userId,
            scan_id: scanId,
            repo,
            branch,
            mode,
            status: "failed",
            error_message: message,
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
        if (!isLlmConfigured()) {
          console.warn("[security-scan] LLM API key missing")
          return []
        }

        const prompt = buildSecurityScanPrompt(files, tree, commits, repo, mode)
        const baseUrl = getLlmBaseUrl()
        const modelId = getDefaultModelId()
        console.log(`[security-scan] analysing with ${modelId} via ${baseUrl}`)

        try {
          const { text } = await generateText({
            model: qwenModel(),
            maxOutputTokens: 8192,
            timeout: SECURITY_SCAN_LLM_TIMEOUT_MS,
            messages: [{ role: "user", content: prompt }],
          })
          if (!text) return []
          return parseSecurityFindingsJson(text)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error(`[security-scan] analysis failed via ${baseUrl} model ${modelId}:`, message)
          throw new Error(`LLM analysis failed via ${baseUrl} model ${modelId}: ${message}`)
        }
      })

      const dedup = await step.run("dedup-and-save", async () => {
        const { data: existing } = await supabaseAdmin
          .from("security_findings")
          .select("id, title, file_path, fingerprint, status")
          .eq("user_id", userId)
          .eq("status", "open")

        const existingRows = existing ?? []
        const existingFingerprints = new Set(
          existingRows.map((existingRow) => existingRow.fingerprint || `${existingRow.title}:${existingRow.file_path}`),
        )

        let newCount = 0
        for (const raw of findings) {
          const row = normalizeFindingForDb(raw, scanId, userId)
          const fingerprint = row.fingerprint

          if (existingFingerprints.has(fingerprint)) {
            existingFingerprints.delete(fingerprint)
            continue
          }

          const { error } = await supabaseAdmin.from("security_findings").insert(row)
          if (!error) newCount++
          else if (error.code === "23505") {
            // duplicate fingerprint
          } else {
            console.error("[security-scan] insert finding:", error.message)
          }
        }

        let resolvedCount = 0
        for (const fingerprint of existingFingerprints) {
          const match = existingRows.find(
            (existingRow) =>
              (existingRow.fingerprint || `${existingRow.title}:${existingRow.file_path}`) === fingerprint,
          )
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
          (finding) =>
            (finding.severity || "").toUpperCase() === "CRITICAL" ||
            (finding.severity || "").toUpperCase() === "HIGH",
        )
        if (critical.length === 0) return

        const { ensurePersonalOrganization } = await import("@/lib/organizations")
        const org = await ensurePersonalOrganization(userId)
        const { data: profile } = await supabaseAdmin
          .from("company_profile")
          .select("whatsapp_number")
          .eq("organization_id", org.id)
          .maybeSingle()
        const number = profile?.whatsapp_number as string | undefined
        if (!number?.trim()) return

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
        critical: findings.filter((finding) => (finding.severity || "").toUpperCase() === "CRITICAL").length,
        high: findings.filter((finding) => (finding.severity || "").toUpperCase() === "HIGH").length,
        medium: findings.filter((finding) => (finding.severity || "").toUpperCase() === "MEDIUM").length,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await step.run("record-failed-exception", async () => {
        await supabaseAdmin.from("security_scans").insert({
          user_id: userId,
          scan_id: scanId,
          repo,
          branch,
          mode,
          status: "failed",
          error_message: message.slice(0, 2000),
        })
      })
      throw error
    }
  },
)

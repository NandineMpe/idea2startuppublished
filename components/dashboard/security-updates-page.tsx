"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Shield, Loader2, RefreshCw, AlertTriangle, Github, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast-context"

type GithubRepoOption = { full_name: string; default_branch: string; private: boolean }

type GithubContext = {
  githubConfigured: boolean
  connected: boolean
  githubLogin: string | null
  repos: GithubRepoOption[]
  reposFetchError?: string | null
  repoListErrors?: string[]
  reposEmptyLikelyScope?: boolean
  githubAccountsTried?: number
  selectedRepo: string | null
  selectedBranch: string | null
  selectionSource: "explicit" | "vault" | null
  vaultRepo: string | null
  vaultBranch: string | null
  reposListedViaPat?: boolean
  /** Server token present; used for scan file reads, not for listing other users' repos. */
  serverPatConfigured?: boolean
}

/** Avoids render crashes if the API omits fields or returns an unexpected shape. */
function normalizeGithubContext(raw: unknown): GithubContext {
  if (!raw || typeof raw !== "object") {
    return {
      githubConfigured: false,
      connected: false,
      githubLogin: null,
      repos: [],
      selectedRepo: null,
      selectedBranch: null,
      selectionSource: null,
      vaultRepo: null,
      vaultBranch: null,
      reposListedViaPat: false,
      serverPatConfigured: false,
    }
  }
  const o = raw as Record<string, unknown>
  const reposRaw = o.repos
  const repos: GithubRepoOption[] = Array.isArray(reposRaw)
    ? reposRaw.filter(
        (x): x is GithubRepoOption =>
          Boolean(x) &&
          typeof x === "object" &&
          typeof (x as GithubRepoOption).full_name === "string",
      )
    : []
  const errRaw = o.repoListErrors
  const repoListErrors = Array.isArray(errRaw) ? errRaw.filter((e): e is string => typeof e === "string") : []
  const src = o.selectionSource
  return {
    githubConfigured: Boolean(o.githubConfigured),
    connected: Boolean(o.connected),
    githubLogin: typeof o.githubLogin === "string" ? o.githubLogin : null,
    repos,
    reposFetchError: typeof o.reposFetchError === "string" ? o.reposFetchError : null,
    repoListErrors,
    reposEmptyLikelyScope: Boolean(o.reposEmptyLikelyScope),
    githubAccountsTried: typeof o.githubAccountsTried === "number" ? o.githubAccountsTried : undefined,
    selectedRepo: typeof o.selectedRepo === "string" ? o.selectedRepo : null,
    selectedBranch: typeof o.selectedBranch === "string" ? o.selectedBranch : null,
    selectionSource: src === "explicit" || src === "vault" ? src : null,
    vaultRepo: typeof o.vaultRepo === "string" ? o.vaultRepo : null,
    vaultBranch: typeof o.vaultBranch === "string" ? o.vaultBranch : null,
    reposListedViaPat: Boolean(o.reposListedViaPat),
    serverPatConfigured: Boolean(o.serverPatConfigured),
  }
}

function isValidOwnerRepo(s: string): boolean {
  const parts = s.trim().split("/").filter(Boolean)
  return (
    parts.length === 2 &&
    parts[0].length > 0 &&
    parts[1].length > 0 &&
    parts[0].length <= 200 &&
    parts[1].length <= 200
  )
}

type FindingRow = {
  id: string
  severity: string
  title: string
  description: string | null
  file_path: string | null
  line_number: number | null
  code_snippet: string | null
  exploit_scenario: string | null
  fix_suggestion: string | null
  fix_effort: string | null
  fix_code: string | null
  confidence: number | null
  verification_status: string | null
  phase: number | null
  phase_name: string | null
  category: string | null
  status: string
  created_at: string
}

type LastScan = {
  created_at: string
  status: string
  new_findings: number | null
  resolved_count: number | null
  files_scanned: number | null
  total_findings: number | null
  error_message: string | null
} | null

function severityStyles(s: string | null | undefined) {
  const u = (s ?? "medium").toLowerCase()
  if (u === "critical")
    return { badge: "bg-red-600/15 text-red-700 dark:text-red-400 border-red-600/30", dot: "bg-red-500" }
  if (u === "high")
    return { badge: "bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30", dot: "bg-orange-500" }
  if (u === "medium")
    return { badge: "bg-amber-500/12 text-amber-900 dark:text-amber-200 border-amber-500/25", dot: "bg-amber-500" }
  return { badge: "bg-muted text-muted-foreground border-border", dot: "bg-slate-400" }
}

function formatAgo(iso: string) {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const h = Math.floor(diff / 3600000)
  if (h < 1) return "just now"
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? "" : "s"} ago`
}

/** Outer fence length so pasted snippets can include triple backticks without breaking. */
function fencedCodeBlock(label: string, text: string | null | undefined): string {
  const inner = (text ?? "").replace(/\r\n/g, "\n").trimEnd()
  if (!inner) return ""
  let fence = "```"
  while (inner.includes(fence)) {
    fence += "`"
  }
  const cap = label.trim() ? `${label}\n` : ""
  return `${cap}${fence}\n${inner}\n${fence}\n`
}

/** Full finding text for pasting into Cursor or a ticket. */
function formatFindingClipboardText(f: FindingRow): string {
  const loc =
    f.file_path != null && f.file_path !== ""
      ? `${f.file_path}${f.line_number != null ? `:${f.line_number}` : ""}`
      : "—"
  const lines: string[] = [
    "### Security update (Juno)",
    "",
    `**Title:** ${f.title || "Finding"}`,
    `**Severity:** ${(f.severity ?? "unknown").toUpperCase()}`,
    `**Status:** ${f.status}`,
    `**Finding ID:** ${f.id}`,
  ]
  if (f.verification_status) lines.push(`**Verification:** ${f.verification_status}`)
  if (typeof f.confidence === "number") lines.push(`**Confidence:** ${f.confidence}/10`)
  if (f.phase_name) lines.push(`**Phase:** ${f.phase_name}`)
  if (f.category) lines.push(`**Category:** ${f.category}`)
  lines.push(`**Location:** ${loc}`)
  if (f.created_at) lines.push(`**Reported:** ${f.created_at}`)
  lines.push("")
  if (f.code_snippet?.trim()) {
    lines.push("### Vulnerable code")
    lines.push("")
    lines.push(fencedCodeBlock("", f.code_snippet))
  }
  if (f.description?.trim()) {
    lines.push("### Description")
    lines.push("")
    lines.push(f.description.trim())
    lines.push("")
  }
  if (f.exploit_scenario?.trim()) {
    lines.push("### Exploit scenario")
    lines.push("")
    lines.push(f.exploit_scenario.trim())
    lines.push("")
  }
  if (f.fix_suggestion?.trim() || f.fix_effort || f.fix_code?.trim()) {
    lines.push("### Recommended fix")
    lines.push("")
    if (f.fix_effort) lines.push(`**Estimated effort:** ${f.fix_effort}`)
    if (f.fix_suggestion?.trim()) lines.push(f.fix_suggestion.trim())
    if (f.fix_code?.trim()) {
      lines.push("")
      lines.push("**Suggested fix code:**")
      lines.push("")
      lines.push(fencedCodeBlock("", f.fix_code))
    }
  }
  return lines.join("\n").trimEnd() + "\n"
}

export function SecurityUpdatesPage() {
  const { toast } = useToast()
  const [findings, setFindings] = useState<FindingRow[]>([])
  const [counts, setCounts] = useState({ critical: 0, high: 0, medium: 0, low: 0, total: 0 })
  const [repo, setRepo] = useState<string | null>(null)
  const [branch, setBranch] = useState<string | null>(null)
  const [lastScan, setLastScan] = useState<LastScan>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("open")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [gh, setGh] = useState<GithubContext | null>(null)
  const [ghLoading, setGhLoading] = useState(true)
  const [githubLoadError, setGithubLoadError] = useState<string | null>(null)
  const [savingRepo, setSavingRepo] = useState(false)
  const [branchDraft, setBranchDraft] = useState("")
  const [manualRepo, setManualRepo] = useState("")
  const [patFallbackAvailable, setPatFallbackAvailable] = useState(false)

  const loadGithub = useCallback(async () => {
    setGhLoading(true)
    setGithubLoadError(null)
    const controller = new AbortController()
    /** Stay under typical Vercel function limits; server lists repos in parallel to finish faster. */
    const timeoutMs = 55_000
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch("/api/security/github/repos", {
        signal: controller.signal,
        credentials: "include",
      })
      let parsed: unknown
      try {
        parsed = await res.json()
      } catch {
        setGh(null)
        setGithubLoadError("Invalid response from server when loading GitHub status.")
        return
      }
      const body = parsed as GithubContext & { error?: string }
      if (!res.ok) {
        setGh(null)
        setGithubLoadError(
          typeof body.error === "string" ? body.error : `Could not load GitHub status (${res.status}).`,
        )
        return
      }
      const n = normalizeGithubContext(body)
      setGh(n)
      setBranchDraft(
        typeof body.selectedBranch === "string" && body.selectedBranch.trim()
          ? body.selectedBranch
          : n.vaultBranch || "",
      )
      setManualRepo((prev) => (prev.trim() ? prev : n.vaultRepo || ""))
    } catch (e) {
      setGh(null)
      if (e instanceof Error && e.name === "AbortError") {
        setGithubLoadError(
          `Loading GitHub status timed out after ${Math.round(timeoutMs / 1000)}s. Try again.`,
        )
      } else {
        setGithubLoadError("Could not load GitHub connection status.")
      }
    } finally {
      clearTimeout(timer)
      setGhLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadGithub()
  }, [loadGithub])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = statusFilter === "all" ? "all" : statusFilter
      const res = await fetch(`/api/security?status=${encodeURIComponent(q)}`, {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setFindings(data.findings ?? [])
      setCounts(data.counts ?? { critical: 0, high: 0, medium: 0, low: 0, total: 0 })
      setRepo(data.repo ?? null)
      setBranch(data.branch ?? null)
      setLastScan(data.lastScan ?? null)
      setPatFallbackAvailable(Boolean(data.patFallbackAvailable))
    } catch {
      toast({ title: "Could not load security findings.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setBranchDraft(branch ?? "")
  }, [branch])

  const selectedRepoTrim = useMemo(() => gh?.selectedRepo?.trim() || null, [gh?.selectedRepo])

  const filtered = useMemo(() => {
    if (severityFilter === "all") return findings
    return findings.filter((f) => f.severity?.toLowerCase() === severityFilter)
  }, [findings, severityFilter])

  async function saveRepoSelection(nextRepo: string, nextBranch: string) {
    setSavingRepo(true)
    try {
      const res = await fetch("/api/security/github/repo", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_repo: nextRepo, github_branch: nextBranch }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: typeof data.error === "string" ? data.error : "Could not save repository.",
          variant: "destructive",
        })
        return
      }
      toast({ title: "Repository saved", description: `${nextRepo} · ${nextBranch}` })
      await loadGithub()
      await load()
    } catch {
      toast({ title: "Network error.", variant: "destructive" })
    } finally {
      setSavingRepo(false)
    }
  }

  function onSelectRepo(fullName: string) {
    const meta = gh?.repos.find((r) => r.full_name === fullName)
    const b = meta?.default_branch || "main"
    setBranchDraft(b)
    void saveRepoSelection(fullName, b)
  }

  function applyBranch() {
    const r = repo || selectedRepoTrim
    if (!r?.trim()) return
    void saveRepoSelection(r.trim(), branchDraft.trim() || "main")
  }

  function saveManualRepo() {
    const r = manualRepo.trim()
    if (!isValidOwnerRepo(r)) {
      toast({
        title: "Use owner/repo",
        description: "Two segments separated by a slash, e.g. my-org/my-repository",
        variant: "destructive",
      })
      return
    }
    void saveRepoSelection(r, branchDraft.trim() || "main")
  }

  function useVaultRepoForScans() {
    const r = gh?.vaultRepo?.trim()
    const b = gh?.vaultBranch?.trim() || "main"
    if (!r || !isValidOwnerRepo(r)) {
      toast({
        title: "Configure vault first",
        description: "Set Obsidian vault owner and repo under Integrations, then try again.",
        variant: "destructive",
      })
      return
    }
    setManualRepo(r)
    setBranchDraft(b)
    void saveRepoSelection(r, b)
  }

  async function runScan(mode: "daily" | "comprehensive") {
    setScanning(true)
    try {
      const res = await fetch("/api/security/scan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        ok?: boolean
        repo?: string
        branch?: string
        eventIds?: string[]
      }
      if (!res.ok) {
        toast({
          title: typeof data.error === "string" ? data.error : "Scan could not be queued.",
          variant: "destructive",
        })
        return
      }
      if (data.ok !== true) {
        toast({
          title: "Unexpected response from server.",
          description: "Scan may not have been queued. Check Inngest Events for juno/security-scan.requested.",
          variant: "destructive",
        })
        return
      }
      const where =
        data.repo && data.branch ? `${data.repo} (${data.branch})` : (data.repo ?? "your repo")
      toast({
        title: "Scan queued",
        description: `Security scan queued for ${where}. Results appear after the run completes.`,
      })
    } catch {
      toast({ title: "Network error.", variant: "destructive" })
    } finally {
      setScanning(false)
    }
  }

  async function patchFinding(id: string, status: "fixed" | "false_positive" | "accepted_risk") {
    try {
      const res = await fetch(`/api/security/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        toast({ title: "Could not update finding.", variant: "destructive" })
        return
      }
      toast({ title: "Updated." })
      await load()
    } catch {
      toast({ title: "Network error.", variant: "destructive" })
    }
  }

  async function copyFindingDetails(f: FindingRow) {
    const text = formatFindingClipboardText(f)
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "Full finding is on the clipboard. Paste it into Cursor." })
    } catch {
      toast({
        title: "Could not copy",
        description: "Your browser may block clipboard access. Try again or copy sections manually.",
        variant: "destructive",
      })
    }
  }

  async function copyAllVisibleFindings(rows: FindingRow[]) {
    if (rows.length === 0) return
    const text = rows.map((row) => formatFindingClipboardText(row)).join("\n\n---\n\n")
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied",
        description:
          rows.length === 1
            ? "Full finding is on the clipboard."
            : `${rows.length} findings on the clipboard. Paste into Cursor.`,
      })
    } catch {
      toast({
        title: "Could not copy",
        description: "Your browser may block clipboard access. Try again or copy one finding at a time.",
        variant: "destructive",
      })
    }
  }

  const trend =
    lastScan && lastScan.status === "completed"
      ? `${lastScan.new_findings ?? 0} new · ${lastScan.resolved_count ?? 0} resolved`
      : null

  const canRunScan = Boolean(repo && (gh?.connected || patFallbackAvailable))

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Engineering</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Security updates</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Daily scans of the repository you pick below. The repo picker lists only repositories your account can see
          (GitHub via Integrations). Scans read files using the server{" "}
          <span className="font-mono text-xs">GITHUB_PAT</span> when it is set. The model runs server-side on selected
          files, no local clone.
        </p>
        <p className="text-xs text-muted-foreground">
          {ghLoading ? (
            <>Loading GitHub connection status (this can take up to a minute)…</>
          ) : githubLoadError ? (
            <>GitHub status could not be loaded. Use Retry in the card below.</>
          ) : repo && gh?.connected ? (
            <>
              <span className="font-medium text-foreground">{repo}</span>
              {branch ? ` · ${branch}` : ""}
              {lastScan?.created_at ? (
                <> · Last scan: {formatAgo(lastScan.created_at)}</>
              ) : (
                <> · No scan yet</>
              )}
            </>
          ) : repo && gh && !gh.connected && patFallbackAvailable ? (
            <>
              Profile points at <span className="font-medium text-foreground">{repo}</span>
              {branch ? ` · ${branch}` : ""}. Server-side GitHub access is configured — you can run scans.
            </>
          ) : repo && gh && !gh.connected ? (
            <>
              Profile points at <span className="font-medium text-foreground">{repo}</span>. Set{" "}
              <span className="font-mono">GITHUB_PAT</span> on the server so scans can read the repo.
            </>
          ) : (
            <>
              Link GitHub under Integrations, or add <span className="font-mono">GITHUB_PAT</span> on the server, then
              pick a repo below.
            </>
          )}
        </p>
      </div>

      <Card className="border-border/90">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Repository for scans</CardTitle>
          </div>
          <CardDescription>
            Pick which project to audit. Your selection is saved to the organization profile. Repo lists come from your
            linked GitHub account; you can also type <span className="font-mono">owner/repo</span> manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ghLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading repo list from GitHub…
            </div>
          ) : githubLoadError ? (
            <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <p className="text-sm text-destructive">{githubLoadError}</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => void loadGithub()}>
                Retry
              </Button>
            </div>
          ) : !gh?.githubConfigured ? (
            <p className="text-sm text-muted-foreground">
              Connect GitHub on the{" "}
              <Link href="/dashboard/integrations" className="underline underline-offset-2 font-medium text-foreground">
                Integrations
              </Link>{" "}
              page, or add <span className="font-mono">GITHUB_PAT</span> (classic token, repo scope) in the server
              environment so scans can read the repo. Then reload.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {gh.connected ? (
                  <>
                    Listing repos as{" "}
                    {gh.githubLogin ? (
                      <span className="font-medium text-foreground">@{gh.githubLogin}</span>
                    ) : (
                      "your linked GitHub"
                    )}
                    .{" "}
                  </>
                ) : (
                  <>No personal GitHub link yet. Use the manual <span className="font-mono">owner/repo</span> field, or{" "}
                  <Link
                    href="/dashboard/integrations"
                    className="underline underline-offset-2 font-medium text-foreground"
                  >
                    connect GitHub
                  </Link>
                  .{" "}
                  </>
                )}
                {gh.serverPatConfigured ? (
                  <>
                    Server <span className="font-mono">GITHUB_PAT</span> is set for reading files during scans.
                  </>
                ) : (
                  <>Add server <span className="font-mono">GITHUB_PAT</span> so scans can read private repos.</>
                )}
                {gh.selectionSource === "vault" && gh.selectedRepo && (
                  <span className="text-xs ml-2">
                    (selection also inferred from Obsidian vault until you pick a repo)
                  </span>
                )}
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_minmax(120px,160px)_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="sec-repo" className="text-xs">
                    Project (repository)
                  </Label>
                  <Select
                    value={selectedRepoTrim ?? undefined}
                    onValueChange={(v) => onSelectRepo(v)}
                    disabled={savingRepo}
                  >
                    <SelectTrigger id="sec-repo" className="h-9 text-xs font-mono">
                      <SelectValue placeholder="Choose a repository…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(280px,50vh)]">
                      {gh.vaultRepo && !gh.repos.some((r) => r.full_name === gh.vaultRepo) && (
                        <SelectItem value={gh.vaultRepo} className="font-mono text-xs">
                          {gh.vaultRepo} · Obsidian vault
                        </SelectItem>
                      )}
                      {gh.repos.map((r) => (
                        <SelectItem key={r.full_name} value={r.full_name} className="font-mono text-xs">
                          {r.full_name}
                          {r.private ? " · private" : ""}
                        </SelectItem>
                      ))}
                      {selectedRepoTrim && !gh.repos.some((r) => r.full_name === selectedRepoTrim) && (
                        <SelectItem value={selectedRepoTrim} className="font-mono text-xs">
                          {selectedRepoTrim} (saved)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sec-branch" className="text-xs">
                    Branch
                  </Label>
                  <Input
                    id="sec-branch"
                    className="h-9 text-xs font-mono"
                    value={branchDraft}
                    onChange={(e) => setBranchDraft(e.target.value)}
                    placeholder="main"
                    disabled={savingRepo || !selectedRepoTrim}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9"
                  disabled={savingRepo || !selectedRepoTrim}
                  onClick={() => applyBranch()}
                >
                  {savingRepo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply branch"}
                </Button>
              </div>
              {(gh.reposFetchError ||
                (gh.repoListErrors && gh.repoListErrors.length > 0) ||
                gh.repos.length === 0) && (
                <div className="space-y-3 rounded-md border border-border/80 bg-muted/20 p-3">
                  {gh.vaultRepo && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8"
                        disabled={savingRepo}
                        onClick={() => useVaultRepoForScans()}
                      >
                        Use Obsidian vault repo for scans
                      </Button>
                      <span className="text-xs font-mono text-muted-foreground">
                        {gh.vaultRepo} · {gh.vaultBranch || "main"}
                      </span>
                    </div>
                  )}
                  {gh.reposFetchError && (
                    <p className="text-xs text-destructive">
                      GitHub list failed: {gh.reposFetchError}
                    </p>
                  )}
                  {gh.repoListErrors && gh.repoListErrors.length > 0 && (
                    <ul className="text-xs text-destructive list-disc pl-4 space-y-0.5">
                      {gh.repoListErrors.map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  )}
                  {!gh.reposFetchError && gh.reposEmptyLikelyScope && (
                    <p className="text-xs text-muted-foreground">
                      GitHub did not return any repos. Check that <span className="font-mono">GITHUB_PAT</span> has{" "}
                      <strong>repo</strong> scope and access to your orgs, or use manual owner/repo below.
                    </p>
                  )}
                  {!gh.reposFetchError && !gh.reposEmptyLikelyScope && gh.repos.length === 0 && !gh.vaultRepo && (
                    <p className="text-xs text-muted-foreground">
                      No repositories returned. Enter owner/repo below (two parts separated by &quot;/&quot;).
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="sec-repo-manual" className="text-xs">
                      Or type repository (owner/repo)
                    </Label>
                    <div className="flex flex-wrap gap-2 items-end">
                      <Input
                        id="sec-repo-manual"
                        className="h-9 text-xs font-mono min-w-[220px] flex-1"
                        placeholder="e.g. octocat/Hello-World"
                        value={manualRepo}
                        onChange={(e) => setManualRepo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveManualRepo()
                        }}
                        disabled={savingRepo}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-9"
                        disabled={savingRepo || !manualRepo.trim()}
                        onClick={() => saveManualRepo()}
                      >
                        Save repo
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={scanning || ghLoading || !canRunScan}
          onClick={() => void runScan("daily")}
          className="gap-1.5"
        >
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Scan now
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={scanning || ghLoading || !canRunScan}
          onClick={() => void runScan("comprehensive")}
        >
          Scan comprehensive
        </Button>
        {trend && <span className="text-xs text-muted-foreground ml-2">Trend (last run): {trend}</span>}
      </div>

      {lastScan?.status === "failed" && lastScan.error_message && (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1 min-w-0">
            <p className="font-medium text-foreground">Last scan failed</p>
            <p className="text-muted-foreground text-xs leading-relaxed">{lastScan.error_message}</p>
            {!ghLoading && gh?.connected && (
              <p className="text-xs text-muted-foreground">
                Fix branch/repo access above, then run <span className="font-medium">Scan now</span> again.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Critical", v: counts.critical, key: "critical" },
          { label: "High", v: counts.high, key: "high" },
          { label: "Medium", v: counts.medium, key: "medium" },
          { label: "Total (view)", v: counts.total, key: "total" },
        ].map((c) => (
          <Card key={c.key} className="border-border/80">
            <CardHeader className="py-3 px-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{loading ? "—" : c.v}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">Showing</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="fixed">Fixed</SelectItem>
            <SelectItem value="false_positive">False positive</SelectItem>
            <SelectItem value="accepted_risk">Accepted risk</SelectItem>
            <SelectItem value="auto_resolved">Auto-resolved</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
        {!loading && filtered.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void copyAllVisibleFindings(filtered)}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy all visible
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="space-y-3 py-8 text-sm text-muted-foreground">
          <p>No findings for this filter. Run a scan or check back after the daily job (7:00 UTC).</p>
          {lastScan?.status === "completed" &&
            (lastScan.new_findings ?? 0) > 0 &&
            statusFilter === "open" &&
            counts.total === 0 && (
              <p className="text-amber-700 dark:text-amber-400/90 text-xs leading-relaxed max-w-xl">
                The last run saved {(lastScan.new_findings ?? 0) as number} new finding(s), but this list is empty.
                Confirm you&apos;re logged in as the same Supabase user the scan ran for, then hit Refresh. If you
                invoked the scan from another environment, use the same project URL and account here.
              </p>
            )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((f) => {
            const st = severityStyles(f.severity)
            return (
              <Card key={f.id} className="border-border/90 overflow-hidden">
                <CardHeader className="pb-2 space-y-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className={cn("inline-flex h-2 w-2 rounded-full shrink-0 mt-1.5", st.dot)} aria-hidden />
                      <Badge variant="outline" className={cn("text-[11px] font-medium", st.badge)}>
                        {(f.severity ?? "medium").toUpperCase()}
                      </Badge>
                      {f.phase_name && (
                        <span className="text-[11px] text-muted-foreground">Phase: {f.phase_name}</span>
                      )}
                      {typeof f.confidence === "number" && (
                        <span className="text-[11px] text-muted-foreground">{f.confidence}/10</span>
                      )}
                      {f.verification_status && (
                        <Badge variant="secondary" className="text-[10px]">
                          {f.verification_status}
                        </Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 gap-1.5 text-xs"
                      onClick={() => void copyFindingDetails(f)}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      Copy for Cursor
                    </Button>
                  </div>
                  <CardTitle className="text-base font-semibold leading-snug">{f.title || "Finding"}</CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    {f.file_path || "—"}
                    {f.line_number != null ? `:${f.line_number}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {f.code_snippet && (
                    <pre className="rounded-md border border-border bg-muted/40 p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                      {f.code_snippet}
                    </pre>
                  )}
                  {f.description && <p className="text-muted-foreground">{f.description}</p>}
                  {f.exploit_scenario && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                        Exploit
                      </p>
                      <p className="text-muted-foreground">{f.exploit_scenario}</p>
                    </div>
                  )}
                  {f.fix_suggestion && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                        Fix
                        {f.fix_effort ? ` (${f.fix_effort})` : ""}
                      </p>
                      <p className="text-muted-foreground">{f.fix_suggestion}</p>
                      {f.fix_code && (
                        <pre className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                          {f.fix_code}
                        </pre>
                      )}
                    </div>
                  )}
                  {f.status === "open" && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button size="sm" variant="secondary" onClick={() => void patchFinding(f.id, "fixed")}>
                        Mark fixed
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void patchFinding(f.id, "false_positive")}>
                        False positive
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void patchFinding(f.id, "accepted_risk")}>
                        Accept risk
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

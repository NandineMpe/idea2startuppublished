"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Shield, Loader2, RefreshCw, AlertTriangle, Github, Plug } from "lucide-react"
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
  pipedreamConfigured: boolean
  connected: boolean
  githubLogin: string | null
  repos: GithubRepoOption[]
  reposFetchError?: string | null
  reposEmptyLikelyScope?: boolean
  selectedRepo: string | null
  selectedBranch: string | null
  selectionSource: "explicit" | "vault" | null
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
  const [savingRepo, setSavingRepo] = useState(false)
  const [branchDraft, setBranchDraft] = useState("")
  const [manualRepo, setManualRepo] = useState("")

  const loadGithub = useCallback(async () => {
    setGhLoading(true)
    try {
      const res = await fetch("/api/security/github/repos")
      if (!res.ok) throw new Error("github")
      const data = (await res.json()) as GithubContext
      setGh(data)
      setBranchDraft(data.selectedBranch ?? "")
    } catch {
      setGh(null)
    } finally {
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
      const res = await fetch(`/api/security?status=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setFindings(data.findings ?? [])
      setCounts(data.counts ?? { critical: 0, high: 0, medium: 0, low: 0, total: 0 })
      setRepo(data.repo ?? null)
      setBranch(data.branch ?? null)
      setLastScan(data.lastScan ?? null)
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
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(r)) {
      toast({ title: "Use owner/repo", description: "Example: acme/web-app", variant: "destructive" })
      return
    }
    void saveRepoSelection(r, branchDraft.trim() || "main")
  }

  async function runScan(mode: "daily" | "comprehensive") {
    setScanning(true)
    try {
      const res = await fetch("/api/security/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: typeof data.error === "string" ? data.error : "Scan could not be queued.",
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Scan queued",
        description: `Security scan queued for ${data.repo ?? "repo"}. Results appear after the run completes.`,
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

  const trend =
    lastScan && lastScan.status === "completed"
      ? `${lastScan.new_findings ?? 0} new · ${lastScan.resolved_count ?? 0} resolved`
      : null

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Engineering</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Security updates</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Daily scans of the repository you pick below. GitHub access uses your Pipedream Connect account (same as
          Integrations). Claude analyses selected files server-side — no local clone.
        </p>
        <p className="text-xs text-muted-foreground">
          {repo && gh?.connected ? (
            <>
              <span className="font-medium text-foreground">{repo}</span>
              {branch ? ` · ${branch}` : ""}
              {lastScan?.created_at ? (
                <> · Last scan: {formatAgo(lastScan.created_at)}</>
              ) : (
                <> · No scan yet</>
              )}
            </>
          ) : repo && !gh?.connected ? (
            <>
              Profile points at <span className="font-medium text-foreground">{repo}</span> — connect GitHub via
              Pipedream below to run scans.
            </>
          ) : (
            <>Choose a repository below after connecting GitHub.</>
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
            Connect once under Integrations; then pick which project to audit. Your selection is saved to your
            profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ghLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking Pipedream / GitHub…
            </div>
          ) : !gh?.pipedreamConfigured ? (
            <p className="text-sm text-muted-foreground">
              Pipedream is not configured on the server. Set Pipedream env vars to list repositories.
            </p>
          ) : !gh.connected ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Connect your GitHub account with Pipedream so Juno can read repo files for security analysis.
              </p>
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link href="/dashboard/integrations">
                  <Plug className="h-3.5 w-3.5" />
                  Open Integrations
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm">
                <span className="text-muted-foreground">Connected as</span>{" "}
                <span className="font-medium text-foreground">@{gh.githubLogin ?? "github"}</span>
                {gh.selectionSource === "vault" && gh.selectedRepo && (
                  <span className="text-muted-foreground text-xs ml-2">
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
              {(gh.reposFetchError || gh.repos.length === 0) && (
                <div className="space-y-3 rounded-md border border-border/80 bg-muted/20 p-3">
                  {gh.reposFetchError && (
                    <p className="text-xs text-destructive">
                      GitHub list failed: {gh.reposFetchError}
                    </p>
                  )}
                  {!gh.reposFetchError && gh.reposEmptyLikelyScope && (
                    <p className="text-xs text-muted-foreground">
                      The list is empty even though you are connected. For <strong>private</strong> repositories, the
                      GitHub connection in Pipedream must include the <strong>repo</strong> OAuth scope. Open your
                      Pipedream project → Connect → GitHub, ensure full repo access is requested, then reconnect under{" "}
                      <Link href="/dashboard/integrations" className="underline font-medium">
                        Integrations
                      </Link>
                      .
                    </p>
                  )}
                  {!gh.reposFetchError && !gh.reposEmptyLikelyScope && gh.repos.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No repositories returned. You can still enter a repository below if you know the owner and name.
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="sec-repo-manual" className="text-xs">
                      Enter repository manually (owner/repo)
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
          disabled={scanning || !repo || !gh?.connected}
          onClick={() => void runScan("daily")}
          className="gap-1.5"
        >
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Scan now
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={scanning || !repo || !gh?.connected}
          onClick={() => void runScan("comprehensive")}
        >
          Scan comprehensive
        </Button>
        {trend && <span className="text-xs text-muted-foreground ml-2">Trend (last run): {trend}</span>}
      </div>

      {lastScan?.status === "failed" && lastScan.error_message && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{lastScan.error_message}</span>
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
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">
          No findings for this filter. Run a scan or check back after the daily job (7:00 UTC).
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((f) => {
            const st = severityStyles(f.severity)
            return (
              <Card key={f.id} className="border-border/90 overflow-hidden">
                <CardHeader className="pb-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex h-2 w-2 rounded-full shrink-0", st.dot)} aria-hidden />
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

"use client"

import { useState, useEffect, useCallback } from "react"
import { Github, Loader2, CheckCircle2, AlertCircle, BookMarked } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

type VaultState = {
  owner: string
  repo: string
  branch: string
  path: string
}

export function GithubVaultSettings() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<VaultState>({
    owner: "",
    repo: "",
    branch: "main",
    path: "",
  })
  const [lastProbe, setLastProbe] = useState<{
    fileCount: number
    error: string | null
    samplePaths: string[]
  } | null>(null)
  const [persistedVerify, setPersistedVerify] = useState<{
    at: string | null
    fileCount: number | null
    error: string | null
  }>({ at: null, fileCount: null, error: null })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings/github-vault")
      if (!res.ok) return
      const data = await res.json()
      setForm({
        owner: data.owner ?? "",
        repo: data.repo ?? "",
        branch: data.branch ?? "main",
        path: data.path ?? "",
      })
      setPersistedVerify({
        at: data.lastVerifiedAt ?? null,
        fileCount: data.lastProbeFileCount ?? null,
        error: data.lastProbeError ?? null,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setLastProbe(null)
    try {
      const res = await fetch("/api/settings/github-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: form.owner.trim() || null,
          repo: form.repo.trim() || null,
          branch: form.branch.trim() || "main",
          path: form.path.trim(),
          probe: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Save failed")
      }
      if (data.probe) {
        setLastProbe({
          fileCount: data.probe.fileCount ?? 0,
          error: data.probe.error ?? null,
          samplePaths: data.probe.samplePaths ?? [],
        })
      }
      if (data.cleared) {
        toast({ title: "GitHub vault disconnected" })
      } else {
        toast({
          title: "Saved",
          description:
            data.probe?.fileCount != null
              ? `${data.probe.fileCount} markdown file(s) visible to agents.`
              : "Vault settings updated.",
        })
      }
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border bg-card border-primary/15">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BookMarked className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-[15px] flex items-center gap-2">
              Obsidian vault (GitHub)
            </CardTitle>
            <CardDescription className="text-[13px] leading-relaxed mt-1">
              Sync your vault to a repo with{" "}
              <a
                href="https://github.com/Vinzent03/obsidian-git"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                obsidian-git
              </a>
              . Juno reads <code className="text-[11px] bg-muted px-1 rounded">.md</code> files via the GitHub API and merges them into agent context together with the Supabase profile and semantic memory.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gh-owner" className="text-[12px]">
                  GitHub owner / org
                </Label>
                <Input
                  id="gh-owner"
                  placeholder="e.g. acme-corp"
                  value={form.owner}
                  onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                  className="bg-background font-mono text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gh-repo" className="text-[12px]">
                  Repository name
                </Label>
                <Input
                  id="gh-repo"
                  placeholder="e.g. founder-brain"
                  value={form.repo}
                  onChange={(e) => setForm((f) => ({ ...f, repo: e.target.value }))}
                  className="bg-background font-mono text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gh-branch" className="text-[12px]">
                  Branch
                </Label>
                <Input
                  id="gh-branch"
                  placeholder="main"
                  value={form.branch}
                  onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
                  className="bg-background font-mono text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gh-path" className="text-[12px]">
                  Path prefix <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="gh-path"
                  placeholder="e.g. notes/ or leave empty"
                  value={form.path}
                  onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
                  className="bg-background font-mono text-[13px]"
                />
              </div>
            </div>

            {(persistedVerify.at || persistedVerify.error != null) && (
              <p className="text-[11px] text-muted-foreground rounded-md border border-border/80 bg-muted/20 px-2.5 py-2">
                <span className="font-medium text-foreground">Last verified: </span>
                {persistedVerify.at
                  ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
                      new Date(persistedVerify.at),
                    )
                  : "—"}
                {persistedVerify.fileCount != null && (
                  <span className="text-foreground"> · {persistedVerify.fileCount} markdown file(s)</span>
                )}
                {persistedVerify.error && (
                  <span className="text-amber-600 dark:text-amber-400"> · {persistedVerify.error}</span>
                )}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                Save &amp; test connection
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm({ owner: "", repo: "", branch: "main", path: "" })
                  void (async () => {
                    setSaving(true)
                    try {
                      const res = await fetch("/api/settings/github-vault", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ owner: null, repo: null, probe: false }),
                      })
                      if (res.ok) {
                        toast({ title: "Vault link removed" })
                        setLastProbe(null)
                      }
                    } finally {
                      setSaving(false)
                    }
                  })()
                }}
                disabled={saving}
              >
                Disconnect
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Private repos need <code className="text-[10px] bg-muted px-1 rounded">GITHUB_VAULT_TOKEN</code> on the server
              (Contents: Read). Full setup: <code className="text-[10px] bg-muted px-1 rounded">docs/obsidian-github-vault.md</code> in the project.
            </p>

            {lastProbe && (
              <div
                className={`rounded-lg border p-3 text-[12px] ${
                  lastProbe.error
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-100/90"
                    : "border-emerald-500/25 bg-emerald-500/5 text-emerald-100/90"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {lastProbe.error ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  )}
                  {lastProbe.error
                    ? lastProbe.error
                    : `${lastProbe.fileCount} markdown file(s) will be included in agent context.`}
                </div>
                {!lastProbe.error && lastProbe.samplePaths.length > 0 && (
                  <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-muted-foreground">
                    {lastProbe.samplePaths.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

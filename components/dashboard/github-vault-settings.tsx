"use client"

import { useCallback, useEffect, useState } from "react"
import { BookMarked, Github, Loader2, RefreshCw, Unplug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { normalizeVaultFolders } from "@/lib/vault-context-shared"

type VaultSettingsState = {
  repo: string
  branch: string
  foldersText: string
}

export function GithubVaultSettings() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connected, setConnected] = useState(false)
  const [fileCount, setFileCount] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [form, setForm] = useState<VaultSettingsState>({
    repo: "",
    branch: "main",
    foldersText: "company\njuno\nresearch",
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings/github-vault")
      if (!res.ok) return
      const data = await res.json()
      setForm({
        repo: data.repo ?? "",
        branch: data.branch ?? "main",
        foldersText: Array.isArray(data.folders) ? data.folders.join("\n") : "company\njuno\nresearch",
      })
      setConnected(Boolean(data.connected))
      setFileCount(Number(data.fileCount ?? 0))
      setLastSyncedAt(typeof data.lastSyncedAt === "string" ? data.lastSyncedAt : null)
      setSyncError(typeof data.syncError === "string" ? data.syncError : null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (syncAfterSave = false, nextForm?: Partial<VaultSettingsState>) => {
    if (syncAfterSave) {
      setSyncing(true)
    } else {
      setSaving(true)
    }

    try {
      const effectiveForm = {
        ...form,
        ...nextForm,
      }

      const res = await fetch("/api/settings/github-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: effectiveForm.repo.trim() || null,
          branch: effectiveForm.branch.trim() || "main",
          folders: normalizeVaultFolders(effectiveForm.foldersText),
          sync: syncAfterSave,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Save failed")
      }

      if (syncAfterSave && data.synced === false && typeof data.syncError === "string" && data.syncError) {
        toast({
          title: "Could not sync vault",
          description: data.syncError,
          variant: "destructive",
        })
        await load()
        return
      }

      setConnected(Boolean(data.connected))
      setFileCount(Number(data.fileCount ?? 0))
      setLastSyncedAt(typeof data.lastSyncedAt === "string" ? data.lastSyncedAt : null)
      setSyncError(typeof data.syncError === "string" ? data.syncError : null)

      toast({
        title:
          typeof data.warning === "string" && data.warning
            ? syncAfterSave
              ? "Vault synced with warning"
              : "Connection saved with warning"
            : syncAfterSave
              ? "Vault synced"
              : data.cleared
                ? "Vault disconnected"
                : "Vault settings saved",
        description:
          typeof data.warning === "string" && data.warning
            ? data.warning
            : syncAfterSave && typeof data.fileCount === "number"
              ? `${data.fileCount} markdown file(s) cached.`
            : undefined,
      })

      await load()
    } catch (error) {
      toast({
        title: syncAfterSave ? "Could not sync vault" : "Could not save vault settings",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
      setSyncing(false)
    }
  }

  return (
    <Card className="border-border bg-card border-primary/15">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <BookMarked className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2 text-[15px]">Obsidian vault cache</CardTitle>
            <CardDescription className="mt-1 text-[13px] leading-relaxed">
              Point Juno at the GitHub repo that mirrors your Obsidian vault. The app caches markdown into
              <code className="ml-1 rounded bg-muted px-1 py-0.5 text-[11px]">vault_context_cache</code> so agents do not hit
              GitHub on every run.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-[11px] text-muted-foreground">Status</div>
                <div className="mt-1 text-sm font-medium">{connected ? "Connected" : "Not connected"}</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-[11px] text-muted-foreground">Repo</div>
                <div className="mt-1 text-sm font-medium">{form.repo || "Not set"}</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-[11px] text-muted-foreground">Last synced</div>
                <div className="mt-1 text-sm font-medium">
                  {lastSyncedAt
                    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
                        new Date(lastSyncedAt),
                      )
                    : "Not yet"}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-[11px] text-muted-foreground">File count</div>
                <div className="mt-1 text-sm font-medium">{fileCount}</div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-background p-4">
              <div className="space-y-1.5">
                <Label htmlFor="gh-repo" className="text-[12px]">
                  GitHub vault repo
                </Label>
                <Input
                  id="gh-repo"
                  placeholder="e.g. NandineMpe/obsidian-vault"
                  value={form.repo}
                  onChange={(e) => setForm((current) => ({ ...current, repo: e.target.value }))}
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
                  onChange={(e) => setForm((current) => ({ ...current, branch: e.target.value }))}
                  className="bg-background font-mono text-[13px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gh-folders" className="text-[12px]">
                  Vault folders
                </Label>
                <Textarea
                  id="gh-folders"
                  rows={4}
                  placeholder={"company\njuno\nresearch"}
                  value={form.foldersText}
                  onChange={(e) => setForm((current) => ({ ...current, foldersText: e.target.value }))}
                  className="min-h-[110px] bg-background font-mono text-[13px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => void save(true)} disabled={saving || syncing} className="gap-2">
                  {saving || syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                  Save + verify
                </Button>
                <Button type="button" variant="outline" onClick={() => void save(true)} disabled={saving || syncing} className="gap-2">
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sync now
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const cleared = { repo: "", branch: "main", foldersText: "company\njuno\nresearch" }
                    setForm(cleared)
                    void save(false, cleared)
                  }}
                  disabled={saving || syncing}
                  className="gap-2"
                >
                  <Unplug className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Private repos need a server-side GitHub token. The vault sync now falls back to <code>GITHUB_PAT</code> in the
              same spirit as the security scanner.
            </p>

            {syncError ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-800 dark:text-amber-300">
                {syncError}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

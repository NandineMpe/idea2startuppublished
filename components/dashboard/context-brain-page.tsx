"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { BookMarked, ChevronDown, ChevronRight, FileDown, FileText, FileUp, Github, Loader2, RefreshCw, Save, Sparkles, Trash2, Unplug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { type ContextData, emptyContextData } from "@/lib/context-view"
import { useToast } from "@/hooks/use-toast"
import { normalizeVaultFolders } from "@/lib/vault-context-shared"
import type { BrainLedgerData } from "@/app/api/company/brain-ledger/route"

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Never"
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" })
}

/** Accepts `owner/repo` or a full `https://github.com/...` URL (same rules as server). */
function normalizeVaultRepoInput(raw: string): string {
  const s = raw.trim()
  if (!s) return ""
  const stripped = s
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "")
  const parts = stripped.split("/").filter(Boolean)
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
  return s
}

function toolLabel(tool: string): string {
  const map: Record<string, string> = {
    onboarding_extraction: "Onboarding Extraction",
    daily_brief: "Daily Brief",
    lead_discovered: "Lead Discovered",
    tech_radar: "Tech Radar",
    staff_meeting: "Staff Meeting",
    relationship_interaction: "Relationship Interaction",
  }
  return map[tool] ?? tool.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function threatColor(level: string | null): string {
  if (level === "high") return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
  if (level === "medium") return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
  return "text-muted-foreground bg-muted/30 border-border"
}

function signalColor(type: string): string {
  if (type === "buying_signal") return "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200"
  if (type === "problem_mention") return "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200"
  return "text-muted-foreground bg-muted/30 border-border"
}

// ─── sub-components ───────────────────────────────────────────────────────────

function Section({ title, count, defaultOpen = true, children, empty, icon }: {
  title: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
  empty?: string
  icon?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="text-sm font-semibold">{title}</span>
          {count !== undefined && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
              {count}
            </span>
          )}
        </div>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          {count === 0 && empty ? (
            <p className="text-sm text-muted-foreground">{empty}</p>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null
  return (
    <div className="mb-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function TagList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="mb-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="inline-block rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-foreground">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function TimelineItem({ date, label, children }: {
  date: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="relative pl-4 border-l border-border last:border-l-transparent pb-4 last:pb-0">
      <div className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-border bg-background" />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-medium text-muted-foreground">{formatDate(date)}</span>
        <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground/70">{label}</span>
      </div>
      {children}
    </div>
  )
}

// ─── Vault file list ──────────────────────────────────────────────────────────

function VaultFileList({ files }: { files: BrainLedgerData["vault"]["files"] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (!files.length) return null
  return (
    <div className="mt-3 space-y-1.5">
      {files.map((f) => (
        <div key={f.path} className="rounded-lg border border-border bg-muted/10 overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/20 transition-colors"
            onClick={() => setExpanded(expanded === f.path ? null : f.path)}
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-[12px] font-mono text-foreground/80 flex-1 truncate">{f.path}</span>
            {expanded === f.path
              ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
          </button>
          {expanded === f.path && f.preview && (
            <div className="border-t border-border px-3 py-2.5 font-mono text-[11px] leading-relaxed text-foreground/70 whitespace-pre-wrap bg-muted/5">
              {f.preview}{f.preview.length >= 200 ? "\n…" : ""}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Inline Vault Settings ────────────────────────────────────────────────────

function VaultInlineSettings({ onSynced }: { onSynced: () => void }) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [form, setForm] = useState({ repo: "", branch: "main", foldersText: "company\njuno\nresearch" })
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const [lastFileCount, setLastFileCount] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/settings/github-vault", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setForm({
          repo: data.repo ?? "",
          branch: data.branch ?? "main",
          foldersText: Array.isArray(data.folders) ? data.folders.join("\n") : "company\njuno\nresearch",
        })
        setLastSyncError(typeof data.syncError === "string" ? data.syncError : null)
        setLastFileCount(typeof data.fileCount === "number" ? data.fileCount : null)
      })
      .catch(() => {})
  }, [])

  async function save(syncAfterSave: boolean) {
    syncAfterSave ? setSyncing(true) : setSaving(true)
    try {
      const normalizedRepo = normalizeVaultRepoInput(form.repo)
      const res = await fetch("/api/settings/github-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          repo: normalizedRepo || null,
          branch: form.branch.trim() || "main",
          folders: normalizeVaultFolders(form.foldersText),
          sync: syncAfterSave,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed")
      if (normalizedRepo) {
        setForm((f) => ({ ...f, repo: normalizedRepo }))
      }
      setLastSyncError(typeof data.syncError === "string" ? data.syncError : null)
      setLastFileCount(typeof data.fileCount === "number" ? data.fileCount : null)
      toast({
        title: syncAfterSave ? `Vault synced — ${data.fileCount ?? 0} file(s) cached` : "Vault settings saved",
        description: typeof data.warning === "string" && data.warning ? data.warning : undefined,
      })
      onSynced()
    } catch (e) {
      toast({ title: "Could not save vault", description: e instanceof Error ? e.message : "Try again", variant: "destructive" })
    } finally {
      setSaving(false)
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
        <p>
          Enter the vault repo as <span className="font-mono text-foreground/90">owner/repo</span>, or paste the full GitHub URL. Juno reads markdown from that repo (Obsidian syncs here via git).
        </p>
        <p className="mt-2">
          <span className="font-medium text-foreground/90">Private repo:</span> connect GitHub under{" "}
          <Link href="/dashboard/integrations" className="text-primary underline underline-offset-2 hover:text-primary/90">
            Integrations
          </Link>{" "}
          (Pipedream). The linked GitHub user must be able to read this repo (same org or collaborator). Otherwise set{" "}
          <span className="font-mono text-[11px]">GITHUB_VAULT_TOKEN</span> in Vercel with repo access.
        </p>
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">GitHub repo</label>
        <input
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[13px] outline-none focus:ring-1 focus:ring-ring"
          placeholder="your-org/your-vault or https://github.com/..."
          value={form.repo}
          onChange={(e) => setForm((f) => ({ ...f, repo: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Branch</label>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[13px] outline-none focus:ring-1 focus:ring-ring"
            placeholder="main"
            value={form.branch}
            onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Folders (one per line)</label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[13px] outline-none focus:ring-1 focus:ring-ring resize-none"
            placeholder={"company\njuno\nresearch"}
            value={form.foldersText}
            onChange={(e) => setForm((f) => ({ ...f, foldersText: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => void save(true)} disabled={saving || syncing} className="gap-1.5">
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Save + Sync
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void save(false)} disabled={saving || syncing} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Github className="h-3.5 w-3.5" />}
          Save only
        </Button>
        <Button
          type="button" size="sm" variant="ghost"
          disabled={saving || syncing}
          className="gap-1.5 text-muted-foreground"
          onClick={() => {
            setForm({ repo: "", branch: "main", foldersText: "company\njuno\nresearch" })
            void save(false)
          }}
        >
          <Unplug className="h-3.5 w-3.5" />
          Disconnect
        </Button>
      </div>
      {lastFileCount != null && lastFileCount >= 0 && (
        <p className="text-[11px] text-muted-foreground">
          Last sync: {lastFileCount} markdown file{lastFileCount === 1 ? "" : "s"} cached for Juno context.
        </p>
      )}
      {lastSyncError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          {lastSyncError}
        </div>
      ) : null}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ContextBrainPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [ledger, setLedger] = useState<BrainLedgerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [contextData, setContextData] = useState<ContextData>(emptyContextData())

  const [markdown, setMarkdown] = useState("")
  const [markdownDirty, setMarkdownDirty] = useState(false)
  const [savingMd, setSavingMd] = useState(false)
  const [importingVault, setImportingVault] = useState(false)
  const [erasingKb, setErasingKb] = useState(false)
  const [contextScope, setContextScope] = useState<"owner" | "workspace" | null>(null)
  const [workspaceLabel, setWorkspaceLabel] = useState<string | null>(null)
  const [extractingProfile, setExtractingProfile] = useState(false)

  async function refresh() {
    try {
      const [ledgerRes, ctxRes] = await Promise.all([
        fetch("/api/company/brain-ledger", { credentials: "include" }),
        fetch("/api/company/context-view", { credentials: "include" }),
      ])
      if (ledgerRes.ok) {
        const j = (await ledgerRes.json()) as { data?: BrainLedgerData }
        setLedger(j.data ?? null)
      }
      if (ctxRes.ok) {
        const j = (await ctxRes.json()) as {
          data: ContextData
          scope?: string
          workspace?: { displayName?: string; companyName?: string | null } | null
        }
        const d = j.data ?? emptyContextData()
        setContextData(d)
        setMarkdown(d.knowledge.markdown)
        setMarkdownDirty(false)
        setContextScope(j.scope === "workspace" ? "workspace" : "owner")
        const w = j.workspace
        setWorkspaceLabel(
          w ? String(w.displayName || w.companyName || "").trim() || null : null,
        )
      }
    } catch {
      toast({ title: "Could not load brain data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    file.text()
      .then((text) => { setMarkdown(text); setMarkdownDirty(true); toast({ title: "File loaded", description: file.name }) })
      .catch(() => toast({ title: "Could not read file", variant: "destructive" }))
  }

  async function saveMarkdown() {
    setSavingMd(true)
    try {
      const res = await fetch("/api/company/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ knowledge_base_md: markdown }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error || "Failed to save")
      await refresh()
      toast({ title: "Knowledge base saved" })
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    } finally {
      setSavingMd(false)
    }
  }

  const vaultHasCache =
    Boolean(contextData.vault.connected) &&
    (Boolean(contextData.vault.lastSyncedAt) || (contextData.vault.fileCount ?? 0) > 0)

  async function importVaultIntoKnowledgeBase() {
    if (markdown.trim()) {
      const ok = window.confirm(
        "Replace the text in this box with your cached vault digest? Save afterward if you edit again.",
      )
      if (!ok) return
    }
    setImportingVault(true)
    try {
      const res = await fetch("/api/company/knowledge-from-vault", {
        method: "POST",
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error || "Import failed")
      await refresh()
      toast({
        title: "Imported vault into knowledge base",
        description: "This is the same text Juno already had under Vault context, now also stored as your primary document.",
      })
    } catch (e) {
      toast({
        title: "Could not import",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setImportingVault(false)
    }
  }

  async function eraseSavedKnowledgeBase() {
    const ok = window.confirm(
      "Delete the saved knowledge base document for this workspace? The vault cache is unchanged. You cannot undo this from here.",
    )
    if (!ok) return
    setErasingKb(true)
    try {
      const res = await fetch("/api/company/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ knowledge_base_md: "" }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error || "Failed to erase")
      await refresh()
      toast({ title: "Saved document cleared" })
    } catch (e) {
      toast({
        title: "Could not erase",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setErasingKb(false)
    }
  }

  async function extractProfileFromDocument() {
    if (!markdown.trim()) {
      toast({ title: "No document", description: "Save a knowledge base document first.", variant: "destructive" })
      return
    }
    if (markdownDirty) {
      const ok = window.confirm("Save the document first before extracting? (Click OK to save and extract, Cancel to abort.)")
      if (!ok) return
      await saveMarkdown()
    }
    setExtractingProfile(true)
    try {
      const res = await fetch("/api/company/extract-profile", {
        method: "POST",
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error || "Extraction failed")
      await refresh()
      toast({
        title: "Profile extracted from document",
        description: "Company profile fields have been populated from your knowledge base.",
      })
    } catch (e) {
      toast({
        title: "Could not extract profile",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setExtractingProfile(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const v = ledger?.vault
  const p = ledger?.profile

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Company Brain</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything Juno knows about your business — live context trail below.
          </p>
          {contextScope === "workspace" && workspaceLabel ? (
            <p className="mt-2 text-[12px] text-amber-800 dark:text-amber-200/90 leading-snug rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2">
              You have a team workspace selected ({workspaceLabel}). Saves here go to{" "}
              <span className="font-medium">that workspace</span>, not your personal founder profile. Switch team in the
              sidebar to edit the other.
            </p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} className="gap-1.5 shrink-0">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* ── Obsidian Vault ─────────────────────────────────────────────────── */}
      <Section
        title="Obsidian Vault"
        icon={<BookMarked className="h-4 w-4" />}
        defaultOpen={true}
      >
        {v?.connected ? (
          <div className="space-y-3">
            {/* Status bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Repo", value: v.repo },
                { label: "Branch", value: v.branch },
                { label: "Files cached", value: String(v.file_count) },
                { label: "Last synced", value: formatDateTime(v.last_synced_at) },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="text-[10px] text-muted-foreground">{item.label}</div>
                  <div className="mt-0.5 text-[12px] font-medium font-mono truncate">{item.value}</div>
                </div>
              ))}
            </div>

            {/* File list */}
            {(v.files ?? []).length > 0 ? (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                  Cached files ({v.files.length})
                </div>
                <VaultFileList files={v.files ?? []} />
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">Files are synced but previews are not available yet.</p>
            )}

            {v.sync_error && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-800 dark:text-amber-300">
                {v.sync_error}
              </div>
            )}

            <details className="group">
              <summary className="cursor-pointer text-[12px] text-muted-foreground hover:text-foreground list-none flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
                Change vault settings
              </summary>
              <div className="mt-3">
                <VaultInlineSettings onSynced={refresh} />
              </div>
            </details>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Connect your GitHub-backed Obsidian vault so Juno can read your notes as context.
            </p>
            <VaultInlineSettings onSynced={refresh} />
          </div>
        )}
      </Section>

      {/* ── Upload / Paste ─────────────────────────────────────────────────── */}
      <Section title="Knowledge Base Document" defaultOpen={true}>
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            This box is your <span className="text-foreground/90">primary markdown document</span> Juno stores in the database. Vault sync above fills a{" "}
            <span className="text-foreground/90">separate</span> cached digest for prompts. They do not auto-merge. Paste or upload your own overview here, or pull the vault digest into this box with the button below.
          </p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            To replace old text: use <span className="font-medium text-foreground/90">Erase saved document</span>, then paste and <span className="font-medium text-foreground/90">Save</span>. Or edit and Save over it.
          </p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Ask any AI (ChatGPT, Qwen, Gemini) for a company overview in markdown, then paste or upload it here.
          </p>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground font-mono leading-relaxed">
            &quot;Generate everything you know about my company [name] as a detailed markdown document covering our product, market, traction, team, and strategy.&quot;
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <FileUp className="h-3.5 w-3.5" />
              Upload .md file
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!vaultHasCache || importingVault || savingMd}
              onClick={() => void importVaultIntoKnowledgeBase()}
              title={!vaultHasCache ? "Sync the vault first so there is a cached digest to import." : undefined}
            >
              {importingVault ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              Import vault into this document
            </Button>
            {contextData.knowledge.updatedAt && (
              <span className="text-xs text-muted-foreground">Last saved {formatDateTime(contextData.knowledge.updatedAt)}</span>
            )}
            <input ref={fileInputRef} type="file" accept=".md,.txt" className="hidden" onChange={handleFileUpload} />
          </div>

          <Textarea
            value={markdown}
            onChange={(e) => { setMarkdown(e.target.value); setMarkdownDirty(true) }}
            placeholder={"# My Company\n\nPaste your markdown here..."}
            className="min-h-[280px] font-mono text-[13px] leading-relaxed resize-y"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void saveMarkdown()} disabled={savingMd || !markdownDirty} className="gap-1.5">
              {savingMd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={extractingProfile || savingMd || !markdown.trim()}
              onClick={() => void extractProfileFromDocument()}
              title="Use AI to extract company profile fields (name, problem, solution, etc.) from this document"
            >
              {extractingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Extract profile from document
            </Button>
            {markdown && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setMarkdown(""); setMarkdownDirty(true) }} className="text-muted-foreground gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Clear draft
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-muted-foreground gap-1.5"
              disabled={erasingKb || savingMd}
              onClick={() => void eraseSavedKnowledgeBase()}
            >
              {erasingKb ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Erase saved document
            </Button>
          </div>
        </div>
      </Section>

      {/* ── Context trail (ledger) ──────────────────────────────────────────── */}
      {ledger && (
        <>
          {/* Company Profile */}
          <Section title="Company Profile">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <div>
                <Field label="Company" value={p?.company_name} />
                <Field label="Tagline" value={p?.tagline} />
                <Field label="Description" value={p?.company_description} />
                <Field label="Problem" value={p?.problem} />
                <Field label="Solution" value={p?.solution} />
                <Field label="Business Model" value={p?.business_model} />
              </div>
              <div>
                <Field label="Market" value={p?.target_market} />
                <Field label="Vertical / Industry" value={p?.vertical || p?.industry} />
                <Field label="Stage" value={p?.stage} />
                <Field label="Traction" value={p?.traction} />
                <Field label="Thesis — Why this, why now" value={p?.thesis} />
                <Field label="Differentiators" value={p?.differentiators} />
              </div>
            </div>
            <TagList label="ICP — Ideal Customer Profiles" items={p?.icp ?? []} />
            <TagList label="Competitors" items={p?.competitors ?? []} />
            <TagList label="Keywords to monitor" items={p?.keywords ?? []} />
            <TagList label="90-day priorities" items={p?.priorities ?? []} />
            <TagList label="Risks" items={p?.risks ?? []} />
            {p?.updated_at && (
              <p className="text-[11px] text-muted-foreground mt-2">Last updated {formatDateTime(p.updated_at)}</p>
            )}
          </Section>

          {(p?.founder_name || p?.founder_background) && (
            <Section title="Founder" defaultOpen={false}>
              <Field label="Name" value={p?.founder_name} />
              <Field label="Location" value={p?.founder_location} />
              <Field label="Background" value={p?.founder_background} />
            </Section>
          )}

          {(p?.brand_voice_dna || p?.brand_promise) && (
            <Section title="Brand Voice & Messaging" defaultOpen={false}>
              <Field label="Brand Promise" value={p?.brand_promise} />
              <Field label="Voice DNA" value={p?.brand_voice_dna} />
              <TagList label="Words to use" items={p?.brand_words_use ?? []} />
              <TagList label="Words to avoid" items={p?.brand_words_never ?? []} />
              <TagList label="Credibility hooks" items={p?.brand_credibility_hooks ?? []} />
            </Section>
          )}

          <Section title="Documents & Assets" count={ledger.assets.length} defaultOpen={false} empty="No documents uploaded yet.">
            <div className="space-y-2">
              {ledger.assets.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/15 px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-medium">{a.title || "Untitled"}</p>
                    {a.source_url && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate max-w-xs">{a.source_url}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{a.type.replace(/_/g, " ")}</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="AI Agent History" count={ledger.ai_outputs.length} defaultOpen={false} empty="No agent outputs yet.">
            <div className="space-y-3">
              {ledger.ai_outputs.map((o) => (
                <TimelineItem key={o.id} date={o.created_at} label={toolLabel(o.tool)}>
                  {o.title && <p className="text-[13px] font-medium mb-0.5">{o.title}</p>}
                  {o.output_preview && (
                    <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">{o.output_preview}</p>
                  )}
                </TimelineItem>
              ))}
            </div>
          </Section>

          <Section title="Competitor Intelligence" count={ledger.competitor_events.length} defaultOpen={false} empty="No competitor events tracked yet.">
            <div className="space-y-3">
              {ledger.competitor_events.map((c) => (
                <TimelineItem key={c.id} date={c.discovered_at} label={c.event_type.replace(/_/g, " ")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium">{c.title}</p>
                      <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">{c.competitor_name}</p>
                      {c.description && <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{c.description}</p>}
                      {c.why_it_matters && <p className="text-[12px] text-muted-foreground mt-1 italic">{c.why_it_matters}</p>}
                      {(c.funding_amount || c.funding_round) && (
                        <p className="text-[12px] text-foreground/80 mt-1">
                          {[c.funding_round, c.funding_amount].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    {c.threat_level && (
                      <span className={cn("shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", threatColor(c.threat_level))}>
                        {c.threat_level}
                      </span>
                    )}
                  </div>
                </TimelineItem>
              ))}
            </div>
          </Section>

          <Section title="Funding Intelligence" count={ledger.funding_events.length} defaultOpen={false} empty="No funding events tracked yet.">
            <div className="space-y-3">
              {ledger.funding_events.map((f) => (
                <TimelineItem key={f.id} date={f.announced_date ?? f.discovered_at} label={f.is_competitor ? "competitor" : "market"}>
                  <p className="text-[13px] font-medium">{f.company_name}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {[f.round_type, f.amount, f.lead_investor && `Led by ${f.lead_investor}`].filter(Boolean).join(" · ")}
                  </p>
                  {f.relevance && <p className="text-[12px] text-muted-foreground mt-1 italic">{f.relevance}</p>}
                  {f.signal && <p className="text-[12px] text-foreground/70 mt-1">{f.signal}</p>}
                </TimelineItem>
              ))}
            </div>
          </Section>

          <Section title="Buyer Intent Signals" count={ledger.intent_signals.length} defaultOpen={false} empty="No intent signals captured yet.">
            <div className="space-y-3">
              {ledger.intent_signals.map((s) => (
                <TimelineItem key={s.id} date={s.discovered_at} label={s.platform}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-[13px] font-medium leading-snug">{s.title}</p>
                      {s.why_relevant && <p className="text-[12px] text-muted-foreground mt-1">{s.why_relevant}</p>}
                      {s.matched_keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {s.matched_keywords.map((k, i) => (
                            <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{k}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", signalColor(s.signal_type))}>
                        {s.signal_type.replace(/_/g, " ")}
                      </span>
                      {s.urgency && <span className="text-[10px] text-muted-foreground uppercase">{s.urgency}</span>}
                    </div>
                  </div>
                </TimelineItem>
              ))}
            </div>
          </Section>

          <Section title="Outreach Log" count={ledger.outreach.length} defaultOpen={false} empty="No outreach sent yet.">
            <div className="space-y-2">
              {ledger.outreach.map((o) => (
                <div key={o.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/15 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{o.subject || "(No subject)"}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {[o.to_name, o.to_title, o.to_company].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide",
                      o.outcome ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                    )}>
                      {o.outcome ?? o.status}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(o.sent_at ?? o.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Daily Intelligence Briefs" count={ledger.daily_briefs.length} defaultOpen={false} empty="No daily briefs generated yet.">
            <div className="space-y-2">
              {ledger.daily_briefs.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/15 px-3 py-2.5">
                  <p className="text-[13px] font-medium">{formatDate(b.brief_date)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {b.scored_item_count} items scored from {b.raw_item_count} raw
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Juno Conversations" count={ledger.chat_sessions.length} defaultOpen={false} empty="No conversations yet.">
            <div className="space-y-2">
              {ledger.chat_sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/15 px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-medium">{s.title || "Untitled conversation"}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{s.channel} · {s.message_count} messages</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground shrink-0">{formatDate(s.updated_at)}</p>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

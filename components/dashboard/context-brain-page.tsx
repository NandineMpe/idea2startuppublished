"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, FileUp, Github, Loader2, RefreshCw, Save, Trash2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

function isVaultSyncWarning(message: string | null | undefined): boolean {
  return Boolean(message && /^No markdown files found/i.test(message))
}

// ─── sub-components ───────────────────────────────────────────────────────────

function LedgerSection({ title, count, children, empty }: {
  title: string
  count?: number
  children: React.ReactNode
  empty?: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold">{title}</span>
          {count !== undefined && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
              {count}
            </span>
          )}
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
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

// ─── Brain Ledger view ────────────────────────────────────────────────────────

function BrainLedger() {
  const [ledger, setLedger] = useState<BrainLedgerData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetch("/api/company/brain-ledger", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { data?: BrainLedgerData }) => setLedger(j.data ?? null))
      .catch(() => toast({ title: "Could not load ledger", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!ledger) return <p className="text-sm text-muted-foreground">No data found.</p>

  const p = ledger.profile

  return (
    <div className="space-y-4">

      {/* Company Profile */}
      <LedgerSection title="Company Profile" count={undefined}>
        <div className="grid gap-x-8 sm:grid-cols-2">
          <div>
            <Field label="Company" value={p.company_name} />
            <Field label="Tagline" value={p.tagline} />
            <Field label="Description" value={p.company_description} />
            <Field label="Problem" value={p.problem} />
            <Field label="Solution" value={p.solution} />
            <Field label="Business Model" value={p.business_model} />
          </div>
          <div>
            <Field label="Market" value={p.target_market} />
            <Field label="Vertical / Industry" value={p.vertical || p.industry} />
            <Field label="Stage" value={p.stage} />
            <Field label="Traction" value={p.traction} />
            <Field label="Thesis — Why this, why now" value={p.thesis} />
            <Field label="Differentiators" value={p.differentiators} />
          </div>
        </div>
        <TagList label="ICP — Ideal Customer Profiles" items={p.icp} />
        <TagList label="Competitors" items={p.competitors} />
        <TagList label="Keywords to monitor" items={p.keywords} />
        <TagList label="90-day priorities" items={p.priorities} />
        <TagList label="Risks" items={p.risks} />
        {p.updated_at && (
          <p className="text-[11px] text-muted-foreground mt-2">Last updated {formatDateTime(p.updated_at)}</p>
        )}
      </LedgerSection>

      {/* Founder */}
      {(p.founder_name || p.founder_background) && (
        <LedgerSection title="Founder">
          <Field label="Name" value={p.founder_name} />
          <Field label="Location" value={p.founder_location} />
          <Field label="Background" value={p.founder_background} />
        </LedgerSection>
      )}

      {/* Brand Voice */}
      {(p.brand_voice_dna || p.brand_promise) && (
        <LedgerSection title="Brand Voice & Messaging">
          <Field label="Brand Promise" value={p.brand_promise} />
          <Field label="Voice DNA" value={p.brand_voice_dna} />
          <TagList label="Words to use" items={p.brand_words_use} />
          <TagList label="Words to avoid" items={p.brand_words_never} />
          <TagList label="Credibility hooks" items={p.brand_credibility_hooks} />
        </LedgerSection>
      )}

      {/* Knowledge base */}
      <LedgerSection title="Knowledge Base Document">
        {ledger.knowledge.markdown.trim() ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px] text-muted-foreground">
                {ledger.knowledge.word_count.toLocaleString()} words · Last saved {formatDateTime(ledger.knowledge.updated_at)}
              </span>
            </div>
            <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 font-mono text-[12px] leading-relaxed text-foreground/80 max-h-64 overflow-y-auto whitespace-pre-wrap">
              {ledger.knowledge.markdown.slice(0, 2000)}{ledger.knowledge.markdown.length > 2000 ? "\n\n[...truncated — full doc saved]" : ""}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No knowledge base document saved yet. Use the Upload / Paste tab to add one.</p>
        )}
      </LedgerSection>

      {/* Vault */}
      <LedgerSection title="Obsidian Vault">
        {ledger.vault.connected ? (
          <div className="space-y-1.5 text-[13px]">
            <p><span className="text-muted-foreground">Repo:</span> <span className="font-mono">{ledger.vault.repo}</span></p>
            <p><span className="text-muted-foreground">Branch:</span> <span className="font-mono">{ledger.vault.branch}</span></p>
            <p><span className="text-muted-foreground">Files cached:</span> {ledger.vault.file_count}</p>
            <p><span className="text-muted-foreground">Last synced:</span> {formatDateTime(ledger.vault.last_synced_at)}</p>
            {ledger.vault.sync_error && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">{ledger.vault.sync_error}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No vault connected. Use the Obsidian Vault tab to connect one.</p>
        )}
      </LedgerSection>

      {/* Assets */}
      <LedgerSection title="Documents & Assets" count={ledger.assets.length} empty="No documents uploaded yet.">
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
      </LedgerSection>

      {/* AI Agent History */}
      <LedgerSection title="AI Agent History" count={ledger.ai_outputs.length} empty="No agent outputs yet.">
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
      </LedgerSection>

      {/* Competitor Intelligence */}
      <LedgerSection title="Competitor Intelligence" count={ledger.competitor_events.length} empty="No competitor events tracked yet.">
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
      </LedgerSection>

      {/* Funding Tracker */}
      <LedgerSection title="Funding Intelligence" count={ledger.funding_events.length} empty="No funding events tracked yet.">
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
      </LedgerSection>

      {/* Intent Signals */}
      <LedgerSection title="Buyer Intent Signals" count={ledger.intent_signals.length} empty="No intent signals captured yet.">
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
                  {s.urgency && (
                    <span className="text-[10px] text-muted-foreground uppercase">{s.urgency}</span>
                  )}
                </div>
              </div>
            </TimelineItem>
          ))}
        </div>
      </LedgerSection>

      {/* Outreach */}
      <LedgerSection title="Outreach Log" count={ledger.outreach.length} empty="No outreach sent yet.">
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
      </LedgerSection>

      {/* Daily Briefs */}
      <LedgerSection title="Daily Intelligence Briefs" count={ledger.daily_briefs.length} empty="No daily briefs generated yet.">
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
      </LedgerSection>

      {/* Chat Sessions */}
      <LedgerSection title="Juno Conversations" count={ledger.chat_sessions.length} empty="No conversations yet.">
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
      </LedgerSection>

    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "upload" | "vault" | "ledger"

type VaultMutationResponse = {
  cleared?: boolean
  error?: string
  fileCount?: number
  warning?: string | null
}

export function ContextBrainPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<Tab>("upload")
  const [data, setData] = useState<ContextData>(emptyContextData())
  const [loading, setLoading] = useState(true)

  const [markdown, setMarkdown] = useState("")
  const [markdownDirty, setMarkdownDirty] = useState(false)
  const [savingMd, setSavingMd] = useState(false)

  const [vaultRepo, setVaultRepo] = useState("")
  const [vaultBranch, setVaultBranch] = useState("main")
  const [vaultFoldersText, setVaultFoldersText] = useState("")
  const [vaultDirty, setVaultDirty] = useState(false)
  const [savingVault, setSavingVault] = useState(false)
  const [syncingVault, setSyncingVault] = useState(false)
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null)
  const [githubLogin, setGithubLogin] = useState<string | null>(null)

  async function refresh() {
    try {
      const res = await fetch("/api/company/context-view", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load")
      const json = (await res.json()) as { data: ContextData }
      const d = json.data ?? emptyContextData()
      setData(d)
      setMarkdown(d.knowledge.markdown)
      setMarkdownDirty(false)
      setVaultRepo(d.vault.repo)
      setVaultBranch(d.vault.branch || "main")
      setVaultFoldersText(d.vault.folders.join("\n"))
      setVaultDirty(false)
    } catch {
      toast({ title: "Could not load brain data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // Check Pipedream GitHub connection status
    fetch("/api/pipedream/github-verify", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; githubLogin?: string }) => {
        setGithubConnected(Boolean(j.ok))
        setGithubLogin(j.githubLogin ?? null)
      })
      .catch(() => setGithubConnected(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function normalizeRepoInput(value: string): string {
    // Strip full GitHub URLs to just owner/repo
    return value
      .trim()
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\.git$/, "")
      .replace(/\/$/, "")
  }

  function handleRepoChange(value: string) {
    const normalized = normalizeRepoInput(value)
    setVaultRepo(normalized)
    setVaultDirty(true)
  }

  function connectGithubViaPipedream() {
    // Redirect to integrations page where the full Pipedream Connect flow lives
    window.location.href = "/dashboard/integrations?connect=github&return=/dashboard/context"
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    file
      .text()
      .then((text) => {
        setMarkdown(text)
        setMarkdownDirty(true)
        toast({ title: "File loaded", description: file.name })
      })
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

  async function persistVaultSettings(mode: "save" | "sync") {
    const repo = vaultRepo.trim()
    const branch = vaultBranch.trim() || "main"
    const folders = normalizeVaultFolders(vaultFoldersText)
    const shouldSync = Boolean(repo)

    if (mode === "sync" && !repo) {
      toast({ title: "Sync failed", description: "Enter a GitHub repo first.", variant: "destructive" })
      return
    }

    if (mode === "save") setSavingVault(true)
    else setSyncingVault(true)

    try {
      const res = await fetch("/api/settings/github-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          repo: repo || null,
          branch,
          folders,
          sync: shouldSync,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as VaultMutationResponse
      if (!res.ok) throw new Error(json.error || (mode === "save" ? "Failed to save vault" : "Vault sync failed"))

      setVaultDirty(false)
      await refresh()

      if (json.cleared) {
        toast({ title: "Vault disconnected" })
        return
      }

      if (json.warning) {
        toast({
          title: mode === "save" ? "Connection saved with warning" : "Vault synced with warning",
          description: json.warning,
        })
        return
      }

      toast({
        title: mode === "save" ? "Vault connected" : "Vault synced",
        description: typeof json.fileCount === "number" ? `${json.fileCount} file(s) cached` : undefined,
      })
    } catch (e) {
      toast({
        title: mode === "save" ? "Could not save vault" : "Sync failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      if (mode === "save") setSavingVault(false)
      else setSyncingVault(false)
    }
  }

  async function saveVaultSettings() {
    await persistVaultSettings("save")
  }

  async function syncVaultNow() {
    await persistVaultSettings("sync")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "upload", label: "Upload / Paste" },
    { id: "vault", label: "Obsidian Vault" },
    { id: "ledger", label: "Brain Ledger" },
  ]

  return (
    <div className={cn("mx-auto space-y-6", tab === "ledger" ? "max-w-3xl" : "max-w-2xl")}>
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Company Brain</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything Juno knows about your business — feed it, sync it, and read the full ledger.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Upload / Paste tab */}
      {tab === "upload" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ask any AI (ChatGPT, Qwen, Gemini) to generate a company overview in markdown, then paste or upload it here.
            </p>
            <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground font-mono leading-relaxed">
              &quot;Generate everything you know about my company [name] as a detailed markdown document covering our product, market, traction, team, and strategy.&quot;
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5" />
              Upload .md file
            </Button>
            {data.knowledge.updatedAt && (
              <span className="text-xs text-muted-foreground">Last saved {formatDateTime(data.knowledge.updatedAt)}</span>
            )}
            <input ref={fileInputRef} type="file" accept=".md,.txt" className="hidden" onChange={handleFileUpload} />
          </div>

          <Textarea
            value={markdown}
            onChange={(e) => { setMarkdown(e.target.value); setMarkdownDirty(true) }}
            placeholder={"# My Company\n\nPaste your markdown here..."}
            className="min-h-[320px] font-mono text-[13px] leading-relaxed resize-y"
          />

          <div className="flex items-center gap-2">
            <Button type="button" onClick={() => void saveMarkdown()} disabled={savingMd || !markdownDirty}>
              {savingMd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            {markdown && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setMarkdown(""); setMarkdownDirty(true) }}
                className="text-muted-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Obsidian Vault tab */}
      {tab === "vault" && (
        <div className="space-y-5">

          {/* GitHub account status */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Github className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">GitHub account</p>
                  {githubConnected === null && (
                    <p className="text-xs text-muted-foreground">Checking…</p>
                  )}
                  {githubConnected === true && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected{githubLogin ? ` as @${githubLogin}` : ""}
                    </p>
                  )}
                  {githubConnected === false && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Not connected — required for private repos
                    </p>
                  )}
                </div>
              </div>
              {githubConnected === false && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => connectGithubViaPipedream()}
                >
                  <Github className="h-3.5 w-3.5" />
                  Connect GitHub
                </Button>
              )}
            </div>
          </div>

          {/* Sync status cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Vault status",
                value: data.vault.lastSyncedAt ? "Synced" : data.vault.connected ? "Saved, needs sync" : "Not set",
              },
              { label: "Last synced", value: formatDateTime(data.vault.lastSyncedAt) },
              { label: "Files cached", value: String(data.vault.fileCount) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-muted/15 p-3">
                <div className="text-[11px] text-muted-foreground">{label}</div>
                <div className="mt-1 text-sm font-medium">{value}</div>
              </div>
            ))}
          </div>

          {data.vault.connected && !data.vault.lastSyncedAt && !data.vault.syncError && (
            <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
              The repo is saved, but Juno has not pulled any files yet. Use <span className="font-medium">Save + verify</span> or <span className="font-medium">Sync now</span> to test the connection and cache markdown.
            </div>
          )}

          {data.vault.syncError && (
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                isVaultSyncWarning(data.vault.syncError)
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  : "border-destructive/30 bg-destructive/5 text-destructive",
              )}
            >
              {data.vault.syncError}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Point Juno at your GitHub-backed Obsidian vault. Paste the full repo URL or just <span className="font-mono text-foreground/80">owner/repo</span> — it normalizes automatically.
            </p>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">GitHub repo</div>
                <Input
                  value={vaultRepo}
                  onChange={(e) => handleRepoChange(e.target.value)}
                  onBlur={(e) => {
                    const normalized = normalizeRepoInput(e.target.value)
                    if (normalized !== vaultRepo) {
                      setVaultRepo(normalized)
                      setVaultDirty(true)
                    }
                  }}
                  placeholder="NandineMpe/JunoAIObsidian or full GitHub URL"
                  className="font-mono text-[13px]"
                />
                {vaultRepo && !vaultRepo.includes("/") && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Enter as owner/repo — e.g. NandineMpe/JunoAIObsidian</p>
                )}
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Branch</div>
                <Input
                  value={vaultBranch}
                  onChange={(e) => { setVaultBranch(e.target.value); setVaultDirty(true) }}
                  placeholder="main or master"
                  className="font-mono text-[13px] max-w-[180px]"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Check your repo — some vaults use <span className="font-mono">master</span> instead of <span className="font-mono">main</span></p>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Folders to sync <span className="normal-case font-normal">(one per line, leave blank to sync entire vault)</span>
                </div>
                <Textarea
                  value={vaultFoldersText}
                  onChange={(e) => { setVaultFoldersText(e.target.value); setVaultDirty(true) }}
                  rows={3}
                  placeholder={"Leave blank to sync all files\nor enter specific folders:\ncompany\nresearch"}
                  className="font-mono text-[13px]"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void saveVaultSettings()} disabled={savingVault || !vaultDirty}>
                {savingVault ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save + verify
              </Button>
              <Button type="button" variant="outline" onClick={() => void syncVaultNow()} disabled={syncingVault || savingVault}>
                {syncingVault ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync now
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Save + verify checks the repo immediately and caches matching markdown. Auto-sync still runs nightly at 4am UTC.
            </p>
          </div>
        </div>
      )}

      {/* Brain Ledger tab */}
      {tab === "ledger" && <BrainLedger />}
    </div>
  )
}

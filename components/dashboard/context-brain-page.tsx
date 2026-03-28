"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, History, Loader2, Mic, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  type ContextData,
  type JackJillJobRow,
  calcCompleteness,
  contextDataToProfilePayload,
  emptyContextData,
} from "@/lib/context-view"

const OPENER =
  "What's changed since we last talked? You can tell me about a pivot, new traction, competitive developments, or anything else I should know."

function setPathImmutable<T extends Record<string, unknown>>(root: T, path: string, value: unknown): T {
  const next = JSON.parse(JSON.stringify(root)) as T
  const parts = path.split(".")
  let obj: Record<string, unknown> = next as Record<string, unknown>
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (!(p in obj) || typeof obj[p] !== "object" || obj[p] === null) {
      obj[p] = {}
    }
    obj = obj[p] as Record<string, unknown>
  }
  obj[parts[parts.length - 1]] = value as unknown
  return next
}

function CompletenessBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
  const textColor =
    pct >= 80 ? "text-emerald-600 dark:text-emerald-400" : pct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("min-w-[2.25rem] text-xs font-medium tabular-nums", textColor)}>{pct}%</span>
    </div>
  )
}

function Section({
  title,
  children,
  badge,
}: {
  title: string
  children: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div className="mb-4 rounded-[10px] border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  )
}

function EditableField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  if (!value && !editing) {
    return (
      <div className="mb-3.5">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <button
          type="button"
          onClick={() => {
            setDraft("")
            setEditing(true)
          }}
          className="rounded-md border border-dashed border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/60"
        >
          + Add {label.toLowerCase()}
        </button>
      </div>
    )
  }

  return (
    <div className="mb-3.5">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {editing ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          {multiline ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="min-h-[72px] flex-1 resize-y text-[13px] leading-relaxed"
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onChange(draft)
                  setEditing(false)
                }
              }}
              className="flex-1 text-[13px]"
            />
          )}
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onChange(draft)
                setEditing(false)
              }}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(value)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-md border border-transparent px-0 py-1 text-left text-[13px] leading-relaxed text-foreground transition-colors hover:border-border border-b border-b-transparent hover:border-b-border"
        >
          {value}
        </button>
      )}
    </div>
  )
}

function EditableList({
  label,
  items,
  onChange,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState("")

  return (
    <div className="mb-3.5">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-xs"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        ))}
        {adding ? (
          <Input
            autoFocus
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newItem.trim()) {
                onChange([...items, newItem.trim()])
                setNewItem("")
                setAdding(false)
              }
              if (e.key === "Escape") {
                setAdding(false)
                setNewItem("")
              }
            }}
            className="h-8 w-[140px] text-xs"
            placeholder={`New ${label.toLowerCase().replace(/s$/, "")}`}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/50"
          >
            +
          </button>
        )}
      </div>
    </div>
  )
}

function JackJillJobsEditor({
  jobs,
  onChange,
}: {
  jobs: JackJillJobRow[]
  onChange: (next: JackJillJobRow[]) => void
}) {
  const updateRow = (index: number, patch: Partial<JackJillJobRow>) => {
    const next = jobs.map((x, i) => (i === index ? { ...x, ...patch } : x))
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Roles from your Jack &amp; Jill digest (or similar). The lead &amp; job scan scores these <strong>before</strong> HN
        Who&apos;s Hiring and Remotive.
      </p>
      {jobs.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No roles yet. Add a row or paste from email.</p>
      )}
      {jobs.map((row, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border bg-muted/15 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Company</div>
              <Input
                value={row.company}
                onChange={(e) => updateRow(i, { company: e.target.value })}
                className="mt-0.5 h-9 text-sm"
                placeholder="Company"
              />
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Role</div>
              <Input
                value={row.title}
                onChange={(e) => updateRow(i, { title: e.target.value })}
                className="mt-0.5 h-9 text-sm"
                placeholder="e.g. VP Engineering"
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Job URL (optional)</div>
            <Input
              value={row.url ?? ""}
              onChange={(e) => updateRow(i, { url: e.target.value })}
              className="mt-0.5 h-9 text-sm"
              placeholder="https://..."
            />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Notes (optional)</div>
            <Textarea
              value={row.description ?? ""}
              onChange={(e) => updateRow(i, { description: e.target.value })}
              className="mt-0.5 min-h-[60px] text-sm"
              placeholder="Why this listing matters or a snippet from the digest"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-destructive hover:text-destructive"
              onClick={() => onChange(jobs.filter((_, j) => j !== i))}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => onChange([...jobs, { company: "", title: "" }])}
      >
        <Plus className="h-3.5 w-3.5" />
        Add role
      </Button>
    </div>
  )
}

async function readSseStream(res: Response): Promise<{ text: string; sessionId?: string }> {
  const reader = res.body?.getReader()
  if (!reader) return { text: "" }
  const decoder = new TextDecoder()
  let out = ""
  let sessionId: string | undefined
  let carry = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    carry += decoder.decode(value, { stream: true })
    const lines = carry.split("\n")
    carry = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const payload = line.slice(6).trim()
      if (payload === "[DONE]") continue
      try {
        const parsed = JSON.parse(payload) as { text?: string; sessionId?: string; error?: string }
        if (parsed.sessionId) sessionId = parsed.sessionId
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.text) out += parsed.text
      } catch (e) {
        if (e instanceof SyntaxError) continue
        throw e
      }
    }
  }
  if (carry.startsWith("data: ")) {
    const payload = carry.slice(6).trim()
    if (payload !== "[DONE]") {
      try {
        const parsed = JSON.parse(payload) as { text?: string; sessionId?: string }
        if (parsed.sessionId) sessionId = parsed.sessionId
        if (parsed.text) out += parsed.text
      } catch {
        /* noop */
      }
    }
  }
  return { text: out, sessionId }
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface ContextChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
}

type PanelView = "chat" | "history"

export function ContextBrainPage() {
  const [data, setData] = useState<ContextData>(emptyContextData())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showConversation, setShowConversation] = useState(false)
  const [panelView, setPanelView] = useState<PanelView>("chat")
  const [contextSessionId, setContextSessionId] = useState<string | null>(null)
  const [contextSessions, setContextSessions] = useState<ContextChatSession[]>([])
  const [loadingContextSessions, setLoadingContextSessions] = useState(false)
  const [chatAuthenticated, setChatAuthenticated] = useState<boolean | null>(null)
  const [panelMessages, setPanelMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([])
  const [panelInput, setPanelInput] = useState("")
  const [panelStreaming, setPanelStreaming] = useState(false)

  const completeness = calcCompleteness(data)

  const competitorGroups = useMemo(() => {
    const rows = data.competitor_tracking ?? []
    const m = new Map<string, typeof rows>()
    for (const r of rows) {
      const k = r.competitor_name
      const arr = m.get(k) ?? []
      arr.push(r)
      m.set(k, arr)
    }
    return m
  }, [data.competitor_tracking])

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch("/api/company/context-view", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load")
      const json = (await res.json()) as { data: ContextData | null }
      if (json.data) setData(json.data)
    } catch {
      setLoadError("Could not load context.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const persist = useCallback(
    async (next: ContextData) => {
      setSaving(true)
      try {
        const res = await fetch("/api/company/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contextDataToProfilePayload(next)),
        })
        if (!res.ok) throw new Error("Failed to save")
        await refresh()
      } catch {
        setLoadError("Could not save changes.")
      } finally {
        setSaving(false)
      }
    },
    [refresh],
  )

  function updateField(path: string, value: unknown) {
    setData((prev) => {
      const next = setPathImmutable(prev, path, value) as ContextData
      next.meta.completeness = calcCompleteness(next)
      void persist(next)
      return next
    })
  }

  const fetchContextSessions = useCallback(async () => {
    setLoadingContextSessions(true)
    try {
      const res = await fetch("/api/chat/sessions?channel=context", { credentials: "include" })
      const json = (await res.json()) as { authenticated?: boolean; sessions?: ContextChatSession[] }
      setChatAuthenticated(json.authenticated === true)
      setContextSessions(json.sessions || [])
    } catch {
      setContextSessions([])
    } finally {
      setLoadingContextSessions(false)
    }
  }, [])

  const openContextHistory = useCallback(() => {
    setPanelView("history")
    void fetchContextSessions()
  }, [fetchContextSessions])

  const loadContextSession = useCallback(async (session: ContextChatSession) => {
    try {
      const res = await fetch(`/api/chat/sessions/${session.id}`, { credentials: "include" })
      const json = (await res.json()) as {
        messages?: Array<{ role: string; content: string }>
      }
      const rows = json.messages || []
      const loaded: { role: "user" | "assistant"; content: string }[] = rows.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }))
      setPanelMessages(loaded.length > 0 ? loaded : [{ role: "assistant", content: OPENER }])
      setContextSessionId(session.id)
      setPanelView("chat")
    } catch {
      setPanelView("chat")
    }
  }, [])

  const deleteContextSession = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      try {
        await fetch(`/api/chat/sessions/${id}`, { method: "DELETE", credentials: "include" })
        setContextSessions((prev) => prev.filter((s) => s.id !== id))
        if (contextSessionId === id) {
          setContextSessionId(null)
          setPanelMessages([{ role: "assistant", content: OPENER }])
        }
      } catch {
        /* ignore */
      }
    },
    [contextSessionId],
  )

  async function sendPanelMessage() {
    const text = panelInput.trim()
    if (!text || panelStreaming) return
    setPanelInput("")

    const history = [...panelMessages, { role: "user" as const, content: text }]
    setPanelMessages(history)
    setPanelStreaming(true)

    try {
      const res = await fetch("/api/company/context-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: history,
          founderName: data.founder.name,
          brainSummary: JSON.stringify(data, null, 2).slice(0, 12000),
          sessionId: contextSessionId,
        }),
      })
      if (!res.ok) throw new Error("Chat failed")
      const { text: reply, sessionId: sid } = await readSseStream(res)
      if (sid) setContextSessionId(sid)
      setPanelMessages([...history, { role: "assistant", content: reply }])
    } catch {
      setPanelMessages([
        ...history,
        { role: "assistant", content: "Sorry — something went wrong. Try again in a moment." },
      ])
    } finally {
      setPanelStreaming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading context…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[760px] px-5 py-8 font-sans">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] font-medium tracking-tight">Context</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Saved company context for {data.company.name || "your company"}. Included in agent prompts.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            <Link href="/dashboard/knowledge" className="text-primary underline-offset-4 hover:underline">
              Knowledge base &amp; documents
            </Link>
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setPanelMessages([{ role: "assistant", content: OPENER }])
            setPanelInput("")
            setContextSessionId(null)
            setPanelView("chat")
            setShowConversation(true)
          }}
          className="shrink-0 gap-2"
        >
          <Mic className="h-4 w-4" />
          Update context
        </Button>
      </div>

      {loadError && (
        <p className="mb-4 text-sm text-destructive">{loadError}</p>
      )}

      <div className="mb-5 flex flex-col gap-4 rounded-[10px] border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 text-xs text-muted-foreground">Profile completeness</div>
          <CompletenessBar pct={completeness} />
        </div>
        <div className="text-right sm:min-w-[100px]">
          <div className="text-[11px] text-muted-foreground">Last updated</div>
          <div className="text-xs font-medium">{data.meta.lastUpdated}</div>
        </div>
        <div className="text-right sm:min-w-[100px]">
          <div className="text-[11px] text-muted-foreground">Sources</div>
          <div className="text-xs">{data.meta.sources.filter((s) => s !== "—").length || 0} layers</div>
        </div>
      </div>

      {saving && <p className="mb-3 text-xs text-muted-foreground">Saving…</p>}

      <Section title="Company">
        <EditableField label="Name" value={data.company.name} onChange={(v) => updateField("company.name", v)} />
        <EditableField
          label="Description"
          value={data.company.description}
          onChange={(v) => updateField("company.description", v)}
          multiline
        />
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-5">
          <EditableField label="Vertical" value={data.company.vertical} onChange={(v) => updateField("company.vertical", v)} />
          <EditableField label="Stage" value={data.company.stage} onChange={(v) => updateField("company.stage", v)} />
          <EditableField
            label="Business model"
            value={data.company.business_model}
            onChange={(v) => updateField("company.business_model", v)}
          />
          <EditableField label="Traction" value={data.company.traction} onChange={(v) => updateField("company.traction", v)} />
        </div>
      </Section>

      <Section title="Problem and solution">
        <EditableField label="Problem" value={data.company.problem} onChange={(v) => updateField("company.problem", v)} multiline />
        <EditableField label="Solution" value={data.company.solution} onChange={(v) => updateField("company.solution", v)} multiline />
        <EditableField
          label="Differentiators"
          value={data.strategy.differentiators}
          onChange={(v) => updateField("strategy.differentiators", v)}
          multiline
        />
      </Section>

      <Section title="Founder">
        <EditableField label="Name" value={data.founder.name} onChange={(v) => updateField("founder.name", v)} />
        <EditableField
          label="Background"
          value={data.founder.background}
          onChange={(v) => updateField("founder.background", v)}
          multiline
        />
      </Section>

      <Section title="Strategy">
        <EditableField label="Thesis" value={data.strategy.thesis} onChange={(v) => updateField("strategy.thesis", v)} multiline />
        <EditableField label="Market" value={data.company.market} onChange={(v) => updateField("company.market", v)} multiline />
        <EditableList label="ICP" items={data.strategy.icp} onChange={(v) => updateField("strategy.icp", v)} />
        <EditableList label="Competitors" items={data.strategy.competitors} onChange={(v) => updateField("strategy.competitors", v)} />
      </Section>

      <Section title="Priorities and risks">
        <EditableList label="90-day priorities" items={data.strategy.priorities} onChange={(v) => updateField("strategy.priorities", v)} />
        <EditableList label="Risks" items={data.strategy.risks} onChange={(v) => updateField("strategy.risks", v)} />
      </Section>

      <Section
        title="Monitoring keywords"
        badge={<span className="text-[11px] text-muted-foreground">Keyword filters for scans</span>}
      >
        <EditableList label="Keywords" items={data.strategy.keywords} onChange={(v) => updateField("strategy.keywords", v)} />
      </Section>

      <Section
        title="Jack & Jill job list"
        badge={<span className="text-[11px] text-muted-foreground">Lead list</span>}
      >
        <JackJillJobsEditor
          jobs={data.strategy.jack_jill_jobs ?? []}
          onChange={(next) => updateField("strategy.jack_jill_jobs", next)}
        />
      </Section>

      {competitorGroups.size > 0 && (
        <Section
          title="Competitor intelligence"
          badge={
            <span className="text-[11px] text-muted-foreground">From lead scoring</span>
          }
        >
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            Moves and funding Juno detected and kept beyond the daily news window. Edit the competitor list under Strategy;
            this timeline accumulates automatically.
          </p>
          <div className="space-y-4">
            {[...competitorGroups.entries()].map(([name, events]) => (
              <div key={name} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                <div className="text-sm font-medium text-foreground">{name}</div>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed">
                  {events.slice(0, 6).map((ev, i) => (
                    <li key={`${ev.discovered_at}-${i}`} className="text-muted-foreground">
                      <span className="text-foreground/95">{ev.title}</span>
                      <span className="text-xs"> · {ev.event_type.replace(/_/g, " ")}</span>
                      {ev.threat_level ? <span className="text-xs"> · {ev.threat_level}</span> : null}
                      <span className="text-xs tabular-nums"> · {formatRelativeTime(ev.discovered_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {showConversation && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConversation(false)
          }}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-[680px] flex-col rounded-t-2xl bg-background shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                {panelView === "history" && (
                  <button
                    type="button"
                    className="mt-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setPanelView("chat")}
                    aria-label="Back to chat"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <div className="min-w-0">
                  <h3 className="text-[15px] font-medium">
                    {panelView === "history" ? "Saved conversations" : "Update your context"}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {panelView === "history"
                      ? "Threads started from this panel only."
                      : "Edits here are separate from the sidebar chat."}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {panelView === "chat" && (
                  <>
                    <button
                      type="button"
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Conversation history"
                      onClick={openContextHistory}
                    >
                      <History className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="New conversation"
                      onClick={() => {
                        setPanelMessages([{ role: "assistant", content: OPENER }])
                        setContextSessionId(null)
                        setPanelInput("")
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConversation(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {panelView === "history" && (
              <div className="max-h-[45vh] overflow-y-auto border-b border-border px-3 py-2">
                <p className="mb-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/90">Not the same as</span> the bottom-right floating Juno — that
                  list is for quick sidebar chats only.
                </p>
                {loadingContextSessions ? (
                  <div className="flex justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : chatAuthenticated === false ? (
                  <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">
                    Sign in to save and view context conversations.
                  </p>
                ) : contextSessions.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[13px] text-muted-foreground leading-relaxed">
                    No saved threads yet. Send a message above to start one.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {contextSessions.map((s) => (
                      <li key={s.id}>
                        <div className="group flex items-center gap-1 rounded-lg hover:bg-muted">
                          <button
                            type="button"
                            onClick={() => void loadContextSession(s)}
                            className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-[13px] font-medium"
                          >
                            {s.title}
                          </button>
                          <span className="shrink-0 pr-1 text-[11px] text-muted-foreground tabular-nums">
                            {formatRelativeTime(s.updated_at)}
                          </span>
                          <button
                            type="button"
                            className="p-2 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                            onClick={(e) => void deleteContextSession(e, s.id)}
                            aria-label="Delete conversation"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="min-h-[200px] flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {panelView === "chat" && (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground/90">Profile cards are not auto-filled from this chat.</span> What
                  you say is saved in this thread (clock icon above) so Juno can remember the conversation. To change what
                  agents read, edit the fields on the Context page below the dialog, or paste into those fields.
                </div>
              )}
              {panelView === "chat" &&
                panelMessages.map((m, i) => (
                <div key={i} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                      m.role === "assistant" ? "bg-violet-500/15 text-violet-800 dark:text-violet-300" : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
                    )}
                  >
                    {m.role === "assistant" ? "J" : "You"}
                  </div>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
                      m.role === "assistant"
                        ? "rounded-tl-sm border border-border bg-card"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {panelView === "chat" && panelStreaming && (
                <div className="flex gap-2.5 text-sm text-muted-foreground">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-medium text-violet-800 dark:text-violet-300">
                    J
                  </div>
                  Thinking…
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-border px-5 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Mic className="h-4 w-4" />
              </div>
              <Input
                value={panelInput}
                onChange={(e) => setPanelInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void sendPanelMessage()}
                placeholder="Or type here…"
                disabled={panelStreaming || panelView === "history"}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={() => void sendPanelMessage()}
                disabled={panelStreaming || !panelInput.trim() || panelView === "history"}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

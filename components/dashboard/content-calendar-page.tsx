"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  CheckCircle2,
  XCircle,
  Plus,
  Loader2,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import Link from "next/link"
import { cn } from "@/lib/utils"

export type ContentCalendarRow = {
  id: string
  user_id: string
  title: string | null
  body: string
  channel: string
  content_type: string
  scheduled_date: string | null
  scheduled_time: string | null
  status: string
  source: string | null
  source_ref: string | null
  angle: string | null
  target_audience: string | null
  notes: string | null
  posted_url: string | null
  created_at: string
  updated_at: string
}

const CHANNEL_OPTIONS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X" },
  { value: "hn", label: "Hacker News" },
  { value: "reddit", label: "Reddit" },
  { value: "devto", label: "Dev.to" },
  { value: "blog", label: "Blog" },
  { value: "other", label: "Other" },
]

const CONTENT_TYPES = [
  { value: "post", label: "Post" },
  { value: "comment", label: "Comment" },
  { value: "thread", label: "Thread" },
  { value: "article", label: "Article" },
  { value: "outreach", label: "Outreach" },
]

const CHANNEL_COLOR: Record<string, string> = {
  linkedin: "#185FA5",
  x: "#444441",
  hn: "#D85A30",
  reddit: "#D85A30",
  devto: "#0F6E56",
  blog: "#534AB7",
  other: "#888580",
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  approved: "bg-blue-500/15 text-blue-800 dark:text-blue-200 border-blue-500/30",
  posted: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
  skipped: "bg-muted/50 text-muted-foreground line-through border-border",
}

function mondayLocal(d = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function sourceLabel(source: string | null): string {
  switch (source) {
    case "cmo_agent":
      return "CMO"
    case "cto_radar":
      return "CTO radar"
    case "cro_outreach":
      return "CRO"
    case "manual":
      return "Manual"
    case "brief":
      return "Brief"
    default:
      return source ?? "—"
  }
}

function ContentCard({
  row,
  onClick,
  onRemove,
}: {
  row: ContentCalendarRow
  onClick: () => void
  onRemove?: (id: string) => void
}) {
  const ch = row.channel || "other"
  const dot = CHANNEL_COLOR[ch] ?? CHANNEL_COLOR.other
  const preview = row.body.replace(/\s+/g, " ").slice(0, 72)
  return (
    <div className="flex gap-1 items-stretch group">
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 flex-1 text-left rounded-md border border-border bg-card px-2 py-1.5 hover:bg-accent/80 transition-colors"
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: dot }} />
          <span className="text-[10px] font-medium text-muted-foreground truncate uppercase tracking-wide">
            {ch}
          </span>
          <span
            className={cn(
              "text-[10px] px-1 py-px rounded border ml-auto shrink-0",
              STATUS_STYLE[row.status] ?? STATUS_STYLE.draft,
            )}
          >
            {row.status}
          </span>
        </div>
        <p className="text-[12px] font-medium text-foreground line-clamp-2 leading-snug">
          {row.title || preview || "Untitled"}
        </p>
        {row.source && row.source !== "manual" && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{sourceLabel(row.source)}</p>
        )}
      </button>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-auto w-8 shrink-0 rounded-md text-muted-foreground hover:text-destructive opacity-70 group-hover:opacity-100"
          title="Remove from calendar"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove(row.id)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

type DetailState =
  | { mode: "closed" }
  | { mode: "edit"; row: ContentCalendarRow }
  | { mode: "new"; scheduled_date: string | null }

export function ContentCalendarPage({ embedded = false }: { embedded?: boolean }) {
  const [weekStart, setWeekStart] = useState(() => mondayLocal())
  const [scheduled, setScheduled] = useState<ContentCalendarRow[]>([])
  const [unscheduled, setUnscheduled] = useState<ContentCalendarRow[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<DetailState>({ mode: "closed" })
  const [saving, setSaving] = useState(false)
  const [queueOpen, setQueueOpen] = useState(true)

  const [formTitle, setFormTitle] = useState("")
  const [formBody, setFormBody] = useState("")
  const [formChannel, setFormChannel] = useState("linkedin")
  const [formContentType, setFormContentType] = useState("post")
  const [formScheduledDate, setFormScheduledDate] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [formPostedUrl, setFormPostedUrl] = useState("")
  const [formAngle, setFormAngle] = useState("")
  const [formTargetAudience, setFormTargetAudience] = useState("")
  const [copyDone, setCopyDone] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const startStr = toISODateLocal(weekStart)
      const endStr = toISODateLocal(addDays(weekStart, 6))
      const res = await fetch(`/api/content-calendar?start=${startStr}&end=${endStr}`)
      if (!res.ok) return
      const json = (await res.json()) as {
        scheduled?: ContentCalendarRow[]
        unscheduled?: ContentCalendarRow[]
      }
      setScheduled(json.scheduled ?? [])
      setUnscheduled(json.unscheduled ?? [])
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (detail.mode === "closed") return
    if (detail.mode === "edit") {
      const r = detail.row
      setFormTitle(r.title ?? "")
      setFormBody(r.body)
      setFormChannel(r.channel || "linkedin")
      setFormContentType(r.content_type || "post")
      setFormScheduledDate(r.scheduled_date ?? "")
      setFormNotes(r.notes ?? "")
      setFormPostedUrl(r.posted_url ?? "")
      setFormAngle(r.angle ?? "")
      setFormTargetAudience(r.target_audience ?? "")
    } else {
      setFormTitle("")
      setFormBody("")
      setFormChannel("linkedin")
      setFormContentType("post")
      setFormScheduledDate(detail.scheduled_date ?? "")
      setFormNotes("")
      setFormPostedUrl("")
      setFormAngle("")
      setFormTargetAudience("")
    }
    setCopyDone(false)
  }, [detail])

  const weekLabel = useMemo(() => {
    const a = weekStart
    const b = addDays(weekStart, 6)
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
    return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`
  }, [weekStart])

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i)
      return { date: d, iso: toISODateLocal(d) }
    })
  }, [weekStart])

  const byDay = useMemo(() => {
    const m = new Map<string, ContentCalendarRow[]>()
    for (const row of scheduled) {
      const k = row.scheduled_date
      if (!k) continue
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(row)
    }
    return m
  }, [scheduled])

  async function patchRow(id: string, patch: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/content-calendar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) return
      const updated = (await res.json()) as ContentCalendarRow
      if (detail.mode === "edit" && detail.row.id === id) {
        setDetail({ mode: "edit", row: updated })
      }
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function deleteRow(id: string) {
    if (!window.confirm("Remove this item from the calendar? This cannot be undone.")) return
    setSaving(true)
    try {
      const res = await fetch(`/api/content-calendar/${id}`, { method: "DELETE" })
      if (!res.ok) return
      if (detail.mode === "edit" && detail.row.id === id) setDetail({ mode: "closed" })
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit() {
    if (detail.mode !== "edit") return
    const id = detail.row.id
    await patchRow(id, {
      title: formTitle || null,
      body: formBody,
      channel: formChannel,
      content_type: formContentType,
      scheduled_date: formScheduledDate || null,
      notes: formNotes || null,
      posted_url: formPostedUrl || null,
      angle: formAngle || null,
      target_audience: formTargetAudience || null,
    })
  }

  async function createItem() {
    if (detail.mode !== "new") return
    setSaving(true)
    try {
      const res = await fetch("/api/content-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle || null,
          body: formBody,
          channel: formChannel,
          content_type: formContentType,
          scheduled_date: formScheduledDate || null,
          angle: formAngle || null,
          notes: formNotes || null,
        }),
      })
      if (res.ok) {
        setDetail({ mode: "closed" })
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  async function copyBody() {
    await navigator.clipboard.writeText(formBody)
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

  const sheetOpen = detail.mode !== "closed"

  return (
    <div
      className={cn(
        "flex flex-col mx-auto",
        embedded ? "gap-4 w-full" : "gap-6 p-6 lg:p-8 max-w-[1600px]",
      )}
    >
      {embedded ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">GTM · Content</p>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mt-0.5">
            <CalendarDays className="h-5 w-5 text-primary" />
            Content calendar
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1 max-w-2xl">
            Scheduled posts by channel — same data as the sidebar. Copy and post manually; API posting is not available
            yet.{" "}
            <Link href="/dashboard/content-calendar" className="text-primary hover:underline">
              Open full-page calendar
            </Link>
            .
          </p>
        </div>
      ) : (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">CMO workspace</p>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2 mt-1">
            <CalendarDays className="h-7 w-7 text-primary" />
            Content calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Scheduled posts by channel. Copy and post manually; API posting is not available yet.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))}>
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setWeekStart(mondayLocal())}>
          This week
        </Button>
        <span className="text-sm font-medium text-foreground ml-2">{weekLabel}</span>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-7 min-w-[720px] gap-2 border border-border rounded-lg p-2 bg-muted/20">
          {days.map(({ date, iso }) => (
            <div key={iso} className="flex flex-col min-h-[220px] rounded-md bg-background border border-border/80">
              <div className="px-2 py-1.5 border-b border-border/80 flex items-center justify-between gap-1">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {date.toLocaleDateString(undefined, { weekday: "short" })}
                  </p>
                  <p className="text-[13px] font-semibold">{date.getDate()}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  title="New post this day"
                  onClick={() => setDetail({ mode: "new", scheduled_date: iso })}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto max-h-[320px]">
                {(byDay.get(iso) ?? []).map((row) => (
                  <ContentCard
                    key={row.id}
                    row={row}
                    onClick={() => setDetail({ mode: "edit", row })}
                    onRemove={(rid) => void deleteRow(rid)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          onClick={() => setQueueOpen((o) => !o)}
        >
          <span className="text-sm font-medium">Unscheduled queue</span>
          <span className="text-xs text-muted-foreground">
            {unscheduled.length} item{unscheduled.length === 1 ? "" : "s"}
          </span>
        </button>
        {queueOpen && (
          <div className="border-t border-border p-4 space-y-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setDetail({ mode: "new", scheduled_date: null })}>
              <Plus className="h-4 w-4 mr-1" />
              New unscheduled post
            </Button>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {unscheduled.map((row) => (
                <ContentCard
                  key={row.id}
                  row={row}
                  onClick={() => setDetail({ mode: "edit", row })}
                  onRemove={(rid) => void deleteRow(rid)}
                />
              ))}
            </div>
            {unscheduled.length === 0 && (
              <p className="text-sm text-muted-foreground">No undated drafts. Add a date or wait for agent suggestions.</p>
            )}
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={(o) => !o && setDetail({ mode: "closed" })}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detail.mode === "new" ? "New content" : "Edit content"}</SheetTitle>
            <SheetDescription>
              {detail.mode === "edit" && detail.row.source && (
                <span className="text-xs">Source: {sourceLabel(detail.row.source)}</span>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="cc-title">Title</Label>
              <Input
                id="cc-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Short label"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-body">Body</Label>
              <Textarea
                id="cc-body"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={10}
                className="font-mono text-[13px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select value={formChannel} onValueChange={setFormChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formContentType} onValueChange={setFormContentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-date">Scheduled date</Label>
              <Input
                id="cc-date"
                type="date"
                value={formScheduledDate}
                onChange={(e) => setFormScheduledDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Leave empty for backlog (unscheduled).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-angle">Angle</Label>
              <Input id="cc-angle" value={formAngle} onChange={(e) => setFormAngle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-audience">Target audience</Label>
              <Input
                id="cc-audience"
                value={formTargetAudience}
                onChange={(e) => setFormTargetAudience(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-notes">Notes</Label>
              <Textarea id="cc-notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} />
            </div>
            {detail.mode === "edit" && detail.row.status === "posted" && (
              <div className="space-y-2">
                <Label htmlFor="cc-url">Posted URL</Label>
                <Input
                  id="cc-url"
                  value={formPostedUrl}
                  onChange={(e) => setFormPostedUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void copyBody()} disabled={!formBody}>
                <Copy className="h-4 w-4 mr-1" />
                {copyDone ? "Copied" : "Copy body"}
              </Button>
              {detail.mode === "new" ? (
                <Button type="button" size="sm" onClick={() => void createItem()} disabled={saving || !formBody.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={() => void saveEdit()} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
                </Button>
              )}
            </div>

            {detail.mode === "edit" && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={saving || detail.row.status !== "draft"}
                  onClick={() => void patchRow(detail.row.id, { status: "approved" })}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={saving || detail.row.status === "posted"}
                  onClick={() => {
                    const url = window.prompt("Paste public URL after you posted (optional):", formPostedUrl)
                    void patchRow(detail.row.id, {
                      status: "posted",
                      posted_url: url?.trim() || formPostedUrl || null,
                    })
                  }}
                >
                  Mark posted
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving || detail.row.status === "skipped"}
                  onClick={() => void patchRow(detail.row.id, { status: "skipped" })}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Skip
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={saving}
                  onClick={() => void deleteRow(detail.row.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

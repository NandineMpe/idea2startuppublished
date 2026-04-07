"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns"
import { Bookmark, Check, Copy, ExternalLink, Flame, Loader2, MessageCircle, Play, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const SAVED_SIGNALS_STORAGE_KEY = "juno.intent-signals.saved"

const REPLY_LOG_CHANNELS = [
  { value: "reddit_comment", label: "Reddit (comment on thread)" },
  { value: "hn_reply", label: "Hacker News" },
  { value: "linkedin_dm", label: "LinkedIn DM" },
  { value: "x_reply", label: "X (Twitter)" },
  { value: "direct_email", label: "Email" },
  { value: "other", label: "Other or not posted yet" },
] as const

function formatResponsePlatform(v: string | null | undefined): string {
  const m: Record<string, string> = {
    reddit_comment: "Reddit comment",
    hn_reply: "Hacker News",
    linkedin_dm: "LinkedIn DM",
    x_reply: "X",
    direct_email: "Email",
    other: "Other",
  }
  const s = v?.trim() ?? ""
  return m[s] || (s ? s.replace(/_/g, " ") : "")
}

export type IntentSignalRow = {
  id: string
  platform: string
  signal_type: string
  title: string
  body: string | null
  url: string
  author: string | null
  subreddit: string | null
  engagement_score: number | null
  relevance_score: number | null
  why_relevant: string | null
  suggested_response: string | null
  response_platform: string | null
  urgency: string | null
  matched_keywords: string[] | null
  status: string
  responded_at: string | null
  response_notes: string | null
  score_feedback: string | null
  score_feedback_at: string | null
  discovered_at: string
}

type SavedIntentSignal = IntentSignalRow & {
  savedAt: string
}

type IntentSignalsResponse = {
  signals?: IntentSignalRow[]
}

type SavedRibbonGroup = {
  key: string
  label: string
  items: SavedIntentSignal[]
}

function getSavedGroupLabel(date: Date) {
  if (isToday(date)) return "Saved today"
  if (isYesterday(date)) return "Saved yesterday"
  return `Saved ${format(date, "MMM d")}`
}

function readSavedSignals() {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(SAVED_SIGNALS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is SavedIntentSignal => {
      return (
        !!item &&
        typeof item === "object" &&
        typeof (item as SavedIntentSignal).id === "string" &&
        typeof (item as SavedIntentSignal).savedAt === "string" &&
        String((item as SavedIntentSignal).platform ?? "").toLowerCase() === "reddit"
      )
    })
  } catch {
    return []
  }
}

function writeSavedSignals(rows: SavedIntentSignal[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SAVED_SIGNALS_STORAGE_KEY, JSON.stringify(rows))
}

function groupSavedSignals(rows: SavedIntentSignal[]) {
  const sorted = [...rows].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
  const groups = new Map<string, SavedRibbonGroup>()

  for (const row of sorted) {
    const savedDate = new Date(row.savedAt)
    const key = format(savedDate, "yyyy-MM-dd")
    const existing = groups.get(key)

    if (existing) {
      existing.items.push(row)
      continue
    }

    groups.set(key, {
      key,
      label: getSavedGroupLabel(savedDate),
      items: [row],
    })
  }

  return Array.from(groups.values())
}

export function IntentSignalsPanel() {
  const [rows, setRows] = useState<IntentSignalRow[]>([])
  const [savedRows, setSavedRows] = useState<SavedIntentSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanHint, setScanHint] = useState<string | null>(null)
  const [copyId, setCopyId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"new" | "hot" | "responded" | "irrelevant">("new")
  const [logReplyRow, setLogReplyRow] = useState<IntentSignalRow | null>(null)
  const [logChannel, setLogChannel] = useState<string>("reddit_comment")
  const [logNotes, setLogNotes] = useState("")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadSilent = useCallback(async () => {
    try {
      const res = await fetch("/api/intelligence/intent-signals?platform=reddit", { cache: "no-store" })
      if (!res.ok) return

      const json = (await res.json()) as IntentSignalsResponse
      setRows(json.signals ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await loadSilent()
    } finally {
      setLoading(false)
    }
  }, [loadSilent])

  useEffect(() => {
    setSavedRows(readSavedSignals())
    void load()
  }, [load])

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current)
    },
    [],
  )

  useEffect(() => {
    setSavedRows((current) => {
      let changed = false

      const next = current.map((savedRow) => {
        const fresh = rows.find((row) => row.id === savedRow.id)
        if (!fresh) return savedRow

        const merged: SavedIntentSignal = { ...fresh, savedAt: savedRow.savedAt }
        const sameSnapshot = JSON.stringify(merged) === JSON.stringify(savedRow)
        if (!sameSnapshot) changed = true
        return sameSnapshot ? savedRow : merged
      })

      if (changed) {
        writeSavedSignals(next)
        return next
      }

      return current
    })
  }, [rows])

  const savedGroups = useMemo(() => groupSavedSignals(savedRows), [savedRows])

  const statusCounts = useMemo(() => {
    let newC = 0
    let hot = 0
    let responded = 0
    let irrelevant = 0
    for (const r of rows) {
      if (r.status === "new") {
        newC += 1
        if ((r.relevance_score ?? 0) >= 8) hot += 1
      } else if (r.status === "responded") responded += 1
      else if (r.status === "irrelevant") irrelevant += 1
    }
    return { new: newC, hot, responded, irrelevant }
  }, [rows])

  const filteredRows = useMemo(() => {
    const byRelevanceDesc = (a: IntentSignalRow, b: IntentSignalRow) =>
      (b.relevance_score ?? 0) - (a.relevance_score ?? 0)

    if (statusFilter === "new") {
      return [...rows.filter((row) => row.status === "new")].sort(byRelevanceDesc)
    }
    if (statusFilter === "hot") {
      return [...rows.filter((row) => row.status === "new" && (row.relevance_score ?? 0) >= 8)].sort(byRelevanceDesc)
    }
    return rows.filter((row) => row.status === statusFilter)
  }, [rows, statusFilter])

  function openLogReply(row: IntentSignalRow) {
    const p = row.response_platform?.trim()
    const valid = p && REPLY_LOG_CHANNELS.some((c) => c.value === p)
    if (valid) {
      setLogChannel(p!)
    } else if (row.platform === "reddit") {
      setLogChannel("reddit_comment")
    } else if (row.platform === "hn") {
      setLogChannel("hn_reply")
    } else {
      setLogChannel("other")
    }
    setLogNotes(row.response_notes?.trim() ?? "")
    setLogReplyRow(row)
  }

  function isSaved(row: IntentSignalRow) {
    return savedRows.some((savedRow) => savedRow.id === row.id)
  }

  function saveRow(row: IntentSignalRow) {
    const next = [
      {
        ...row,
        savedAt: new Date().toISOString(),
      },
      ...savedRows.filter((savedRow) => savedRow.id !== row.id),
    ]

    setSavedRows(next)
    writeSavedSignals(next)
  }

  function unsaveRow(id: string) {
    const next = savedRows.filter((savedRow) => savedRow.id !== id)
    setSavedRows(next)
    writeSavedSignals(next)
  }

  function toggleSaved(row: IntentSignalRow) {
    if (isSaved(row)) {
      unsaveRow(row.id)
      return
    }

    saveRow(row)
  }

  async function scanNow() {
    setScanning(true)
    setScanError(null)
    setScanHint(null)

    try {
      const res = await fetch("/api/intelligence/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline: "intent" }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        setScanError(typeof data.error === "string" ? data.error : "Scan could not start")
        return
      }

      setScanHint("Reddit scan queued. This page polls every 8s for up to 4 minutes.")

      if (pollRef.current) clearInterval(pollRef.current)
      let ticks = 0
      pollRef.current = setInterval(() => {
        ticks += 1
        void loadSilent()

        if (ticks >= 30) {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
        }
      }, 8000)
    } finally {
      setScanning(false)
    }
  }

  async function copyResponse(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopyId(id)
    setTimeout(() => setCopyId(null), 2000)
  }

  async function updateSignal(
    id: string,
    body: {
      status?: "new" | "responded" | "converted" | "irrelevant"
      response_platform?: string | null
      response_notes?: string | null
      score_feedback?: "too_high" | "ok" | "too_low" | null
    },
  ) {
    setActionId(id)
    try {
      const res = await fetch(`/api/intelligence/intent-signals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        await loadSilent()
      }
    } finally {
      setActionId(null)
    }
  }

  async function submitLogReply() {
    if (!logReplyRow) return
    setActionId(logReplyRow.id)
    try {
      const res = await fetch(`/api/intelligence/intent-signals/${logReplyRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "responded",
          response_platform: logChannel,
          response_notes: logNotes.trim() || null,
        }),
      })
      if (res.ok) {
        setLogReplyRow(null)
        await loadSilent()
      }
    } finally {
      setActionId(null)
    }
  }

  async function markIrrelevant(id: string) {
    await updateSignal(id, { status: "irrelevant" })
  }

  async function setScoreFeedback(id: string, value: "too_high" | "ok" | "too_low" | null) {
    await updateSignal(id, { score_feedback: value })
  }

  return (
    <section id="reddit-intent-signals" className="scroll-mt-24 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">CRO - Type 2</p>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <MessageCircle className="h-5 w-5 shrink-0 text-orange-500" />
            Reddit intent signals
          </h2>
          <p className="mt-0.5 max-w-2xl text-[12px] text-muted-foreground">
            Reddit threads matched to your saved company context. Runs on a schedule (every 4 hours) and on demand.
            Suggested replies appear here if you want to join the conversation, but the main goal is learning what
            buyers actually want. Use <strong className="text-foreground/90">Score fit</strong> or{" "}
            <strong className="text-foreground/90">Not relevant</strong> so later runs can match how you judge relevance.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={scanning || loading}
            onClick={() => void scanNow()}
            className="gap-1.5"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Scan Reddit now
          </Button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Inbox</span>
        {(
          [
            { key: "new" as const, label: "New" },
            { key: "hot" as const, label: "Hot" },
            { key: "responded" as const, label: "Replied" },
            { key: "irrelevant" as const, label: "Not relevant" },
          ] as const
        ).map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={statusFilter === key ? "secondary" : "ghost"}
            className={cn(
              "h-8 gap-1 text-[12px]",
              key === "hot" && statusFilter === "hot" && "border border-orange-500/30 bg-orange-500/15 text-orange-900 dark:text-orange-100",
            )}
            onClick={() => setStatusFilter(key)}
          >
            {key === "hot" ? <Flame className="h-3.5 w-3.5 shrink-0" /> : null}
            {label} ({statusCounts[key]})
          </Button>
        ))}
      </div>

      <div className="space-y-2 px-4 pt-2">
        {scanError && (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-2 text-[12px] text-destructive">
            {scanError}
          </p>
        )}

        {scanHint && !scanError && (
          <p className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2 text-[12px] text-emerald-700 dark:text-emerald-300/90">
            {scanHint}
          </p>
        )}
      </div>

      <div className="px-4 pb-1 pt-3">
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-300">
                <Bookmark className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Saved</p>
                <p className="truncate text-[12px] text-muted-foreground">
                  Compact bookmark strip for posts you want to revisit in this browser.
                </p>
              </div>
            </div>
            <p className="shrink-0 text-[11px] font-medium text-muted-foreground">{savedRows.length} saved</p>
          </div>

          {savedGroups.length === 0 ? (
            <div className="mt-2.5 rounded-md border border-dashed border-border bg-background/80 px-3 py-3 text-[12px] text-muted-foreground">
              Save any post to keep a dated shortlist here.
            </div>
          ) : (
            <div className="mt-2.5 overflow-x-auto pb-1">
              <div className="flex min-w-max items-center gap-2">
              {savedGroups.map((group) => (
                <div key={group.key} className="flex items-center gap-2">
                  <span className="shrink-0 rounded-full border border-border bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </span>

                  {group.items.map((row) => (
                    <div
                      key={row.id}
                      className="group flex max-w-[250px] items-center overflow-hidden rounded-full border border-border bg-background shadow-sm"
                      title={`${row.title}\nSaved ${format(new Date(row.savedAt), "MMM d, h:mm a")}`}
                    >
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 items-center gap-2 px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:bg-muted/60"
                      >
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                          {row.platform}
                        </span>
                        <span className="truncate font-medium">{row.title}</span>
                        {typeof row.relevance_score === "number" && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">{row.relevance_score}/10</span>
                        )}
                      </a>

                      {row.suggested_response?.trim() && (
                        <button
                          type="button"
                          onClick={() => void copyResponse(row.suggested_response!.trim(), row.id)}
                          className="shrink-0 border-l border-border px-2 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                          aria-label={`Copy saved reply for ${row.title}`}
                        >
                          {copyId === row.id ? "Copied" : "Copy"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => unsaveRow(row.id)}
                        className="shrink-0 border-l border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                        aria-label={`Remove ${row.title} from saved posts`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-h-[min(70vh,720px)] space-y-4 overflow-y-auto p-4 pt-3">
        {statusFilter === "new" && statusCounts.hot > 0 ? (
          <div className="rounded-md border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-[12px] text-orange-950 dark:text-orange-100/95">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Flame className="h-3.5 w-3.5 shrink-0" />
              {statusCounts.hot} hot signal{statusCounts.hot === 1 ? "" : "s"} (score 8+) in New
            </span>
            <button
              type="button"
              className="ml-2 text-primary underline decoration-primary/50 underline-offset-2 hover:text-primary/90"
              onClick={() => setStatusFilter("hot")}
            >
              Open Hot inbox
            </button>
          </div>
        ) : null}

        {filteredRows.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">
            {statusFilter === "new" ? (
              <>
                No new Reddit signals yet. Use <strong className="text-foreground/90">Scan Reddit now</strong> or wait for
                the schedule. Saved posts stay pinned in the ribbon above. If scans never return rows, confirm Inngest
                (Vercel <code className="text-[11px]">INNGEST_*</code>) and LLM keys for scoring. Tune phrases in{" "}
                <a href="/dashboard/context" className="text-primary hover:underline">
                  company context
                </a>
                .
              </>
            ) : statusFilter === "hot" ? (
              <>
                No hot signals right now. Hot means new threads with relevance score 8 or higher. Check{" "}
                <button type="button" className="text-primary underline underline-offset-2" onClick={() => setStatusFilter("new")}>
                  New
                </button>{" "}
                for the full queue.
              </>
            ) : statusFilter === "responded" ? (
              <>Nothing in Replied yet. Use <strong className="text-foreground/90">Log reply</strong> on a new signal to record where you posted and optional notes.</>
            ) : (
              <>No threads marked not relevant.</>
            )}
          </p>
        )}

        {filteredRows.map((row) => {
          const score = row.relevance_score ?? 0
          const hot = score >= 8
          const when = formatDistanceToNow(new Date(row.discovered_at), { addSuffix: true })
          const reply = row.suggested_response?.trim() ?? ""
          const saved = isSaved(row)

          return (
            <article
              key={row.id}
              className={cn(
                "space-y-2 rounded-lg border p-3",
                hot ? "border-orange-500/40 bg-orange-500/[0.06]" : "border-border bg-muted/15",
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {hot && (
                  <span className="inline-flex items-center gap-0.5 font-medium text-orange-600 dark:text-orange-400">
                    <Flame className="h-3.5 w-3.5" />
                    Hot signal
                  </span>
                )}

                {saved && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 font-medium text-orange-700 dark:text-orange-300">
                    <Bookmark className="h-3 w-3" />
                    Saved
                  </span>
                )}

                <span className="uppercase">{row.platform}</span>
                {row.subreddit && <span>r/{row.subreddit}</span>}
                <span>{when}</span>
                <span className="ml-auto tabular-nums font-medium text-foreground">{score}/10</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Score fit?
                </span>
                {(
                  [
                    { key: "too_high" as const, label: "Too high" },
                    { key: "ok" as const, label: "About right" },
                    { key: "too_low" as const, label: "Too low" },
                  ] as const
                ).map(({ key, label }) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={row.score_feedback === key ? "secondary" : "ghost"}
                    className={cn(
                      "h-7 px-2 text-[11px]",
                      row.score_feedback === key && "bg-primary/15 font-medium text-foreground",
                    )}
                    disabled={actionId === row.id}
                    onClick={() =>
                      void setScoreFeedback(row.id, row.score_feedback === key ? null : key)
                    }
                  >
                    {label}
                  </Button>
                ))}
                {row.score_feedback_at ? (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    Saved {formatDistanceToNow(new Date(row.score_feedback_at), { addSuffix: true })}
                  </span>
                ) : null}
              </div>

              <h3 className="text-[13px] font-semibold leading-snug text-foreground">{row.title}</h3>

              {row.body && <p className="line-clamp-3 whitespace-pre-wrap text-[12px] text-muted-foreground">{row.body}</p>}

              {row.why_relevant && (
                <div className="rounded-md border border-border/80 bg-background/80 px-2.5 py-2">
                  <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Why it matters</p>
                  <p className="text-[12px] leading-relaxed text-foreground/90">{row.why_relevant}</p>
                </div>
              )}

              {reply && (
                <div className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-2">
                  <p className="mb-1 text-[10px] font-medium uppercase text-emerald-800 dark:text-emerald-200/90">
                    Suggested response
                  </p>
                  <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">{reply}</p>
                  {row.status === "new" && row.response_platform && (
                    <p className="mt-2 text-[10px] text-emerald-900/80 dark:text-emerald-200/70">
                      Model channel hint: {formatResponsePlatform(row.response_platform)}
                    </p>
                  )}
                </div>
              )}

              {row.status === "responded" && (row.responded_at || row.response_platform || row.response_notes?.trim()) && (
                <div className="rounded-md border border-border/80 bg-background/80 px-2.5 py-2">
                  <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Reply log</p>
                  <p className="text-[12px] text-foreground/90">
                    {row.responded_at
                      ? `Logged ${formatDistanceToNow(new Date(row.responded_at), { addSuffix: true })}`
                      : "Marked as replied"}
                    {row.response_platform ? ` · ${formatResponsePlatform(row.response_platform)}` : ""}
                  </p>
                  {row.response_notes?.trim() ? (
                    <p className="mt-1.5 whitespace-pre-wrap text-[12px] text-muted-foreground">{row.response_notes}</p>
                  ) : null}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" asChild>
                  <a href={row.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Open thread
                  </a>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant={saved ? "secondary" : "outline"}
                  disabled={actionId === row.id}
                  onClick={() => toggleSaved(row)}
                  className={cn(
                    "gap-1.5",
                    saved &&
                      "border-orange-500/20 bg-orange-500/10 text-orange-700 hover:bg-orange-500/15 hover:text-orange-700 dark:text-orange-300",
                  )}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  {saved ? "Saved" : "Save"}
                </Button>

                {reply && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={actionId === row.id}
                    onClick={() => void copyResponse(reply, row.id)}
                  >
                    {copyId === row.id ? (
                      <Check className="mr-1 h-3.5 w-3.5" />
                    ) : (
                      <Copy className="mr-1 h-3.5 w-3.5" />
                    )}
                    {copyId === row.id ? "Copied" : "Copy response"}
                  </Button>
                )}

                {row.status === "new" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={actionId === row.id}
                    onClick={() => openLogReply(row)}
                  >
                    Log reply
                  </Button>
                )}

                {row.status === "new" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    disabled={actionId === row.id}
                    title="Moves this thread out of New and tells the next scoring run to treat similar threads as a weaker fit"
                    onClick={() => void markIrrelevant(row.id)}
                  >
                    Not relevant
                  </Button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <Dialog open={!!logReplyRow} onOpenChange={(open) => !open && setLogReplyRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log your reply</DialogTitle>
            <DialogDescription>
              Say where you posted (or that you did not). Saves to the database and moves this thread to Replied.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="log-channel">Channel</Label>
              <Select value={logChannel} onValueChange={setLogChannel}>
                <SelectTrigger id="log-channel" className="text-[13px]">
                  <SelectValue placeholder="Pick channel" />
                </SelectTrigger>
                <SelectContent>
                  {REPLY_LOG_CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-[13px]">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-notes">Notes (optional)</Label>
              <Textarea
                id="log-notes"
                placeholder="Example: left a comment, or DM only, or thread archived"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                rows={3}
                className="resize-y text-[13px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setLogReplyRow(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitLogReply()}
              disabled={!logReplyRow || actionId === logReplyRow.id}
              className="gap-2"
            >
              {actionId === logReplyRow?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

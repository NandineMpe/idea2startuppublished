"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ExternalLink, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FeedFilter, FeedSignal } from "@/lib/creator/load-feed"

/**
 * Lane presentation. Primary lanes carry colour; the three secondary ones are
 * deliberately grey, so a glance down the feed shows how much of it is a
 * document rather than somebody's write-up of one.
 */
const LANE_STYLE: Record<string, string> = {
  courts: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  regulation: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  consultations: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  inspections: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  filings: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  funding: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  procurement: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  patents: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  standards: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  supervisors: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  papers: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  scholarship: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  conferences: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  code: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  models: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  syscards: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  releases: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  jobs: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400",
  retractions: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
}

const SECONDARY = new Set(["news", "books", "discussion"])

const FILTERS: Array<{ key: FeedFilter; label: string; hint: string }> = [
  { key: "all", label: "Everything", hint: "every document collected" },
  { key: "primary", label: "Documents only", hint: "no news, books or forums" },
  { key: "unseen", label: "Not yet read", hint: "the Researcher has not looked at these" },
  { key: "considered", label: "Passed over", hint: "read and not filed. Disagree with it here" },
  { key: "used", label: "Used", hint: "cited in a story" },
]

/** Presets in days back; null means no lower bound. */
const RANGES: Array<{ key: string; label: string; days: number | null }> = [
  { key: "any", label: "Any time", days: null },
  { key: "1", label: "Today", days: 0 },
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "12 months", days: 365 },
]

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
}

function whenLabel(published: string | null, ingested: string): string {
  const iso = published ?? ingested
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 45) return `${days}d ago`
  return new Date(iso).toISOString().slice(0, 10)
}

export function FeedStream({
  initial,
  initialCursor,
}: {
  initial: FeedSignal[]
  initialCursor: string | null
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<FeedFilter>("all")
  const [rangeKey, setRangeKey] = useState("any")
  const [dateField, setDateField] = useState<"published" | "collected">("published")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [signals, setSignals] = useState(initial)
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState<string | null>(null)
  const [worked, setWorked] = useState<Record<string, string>>({})
  const sentinel = useRef<HTMLDivElement | null>(null)

  const load = useCallback(
    async (
      nextFilter: FeedFilter,
      nextCursor: string | null,
      replace: boolean,
      dates: { key: string; field: string; from: string; to: string },
    ) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ filter: nextFilter, dates: dates.field })
        const preset = RANGES.find((r) => r.key === dates.key)
        // A custom range wins over a preset, and either can be one-sided.
        if (dates.from || dates.to) {
          if (dates.from) params.set("from", dates.from)
          if (dates.to) params.set("to", dates.to)
        } else if (preset?.days !== null && preset?.days !== undefined) {
          params.set("from", isoDaysAgo(preset.days))
        }
        if (nextCursor) params.set("cursor", nextCursor)
        const res = await fetch(`/api/creator/feed?${params}`)
        const data = (await res.json()) as { signals?: FeedSignal[]; cursor?: string | null }
        setSignals((prev) => (replace ? (data.signals ?? []) : [...prev, ...(data.signals ?? [])]))
        setCursor(data.cursor ?? null)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  /** Any control change restarts from the top: a cursor from the old query is meaningless. */
  const reload = useCallback(
    (next: {
      filter?: FeedFilter
      rangeKey?: string
      field?: "published" | "collected"
      from?: string
      to?: string
    }) => {
      const f = next.filter ?? filter
      const key = next.rangeKey ?? rangeKey
      const field = next.field ?? dateField
      const from = next.from ?? customFrom
      const to = next.to ?? customTo

      setFilter(f)
      setRangeKey(key)
      setDateField(field)
      setCustomFrom(from)
      setCustomTo(to)
      setCursor(null)
      void load(f, null, true, { key, field, from, to })
    },
    [filter, rangeKey, dateField, customFrom, customTo, load],
  )

  // Fetch the next page when the sentinel comes into view. Observing an element
  // below the fold rather than listening to scroll means this keeps working
  // inside the dashboard's own scroll container, where window scroll events
  // never fire.
  useEffect(() => {
    const node = sentinel.current
    if (!node || !cursor || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void load(filter, cursor, false, {
            key: rangeKey,
            field: dateField,
            from: customFrom,
            to: customTo,
          })
        }
      },
      { rootMargin: "600px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [cursor, loading, filter, rangeKey, dateField, customFrom, customTo, load])

  async function work(signal: FeedSignal) {
    setWorking(signal.id)
    try {
      const res = await fetch("/api/creator/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal_id: signal.id }),
      })
      const data = (await res.json()) as { verdict?: string; receipts?: number; error?: string }
      setWorked((prev) => ({
        ...prev,
        [signal.id]: data.error
          ? data.error
          : `Filed: ${data.verdict === "not_supported" ? "watchlist, sources do not back it" : `${data.verdict} on ${data.receipts} receipts`}`,
      }))
      if (!data.error) router.refresh()
    } catch (e) {
      setWorked((prev) => ({ ...prev, [signal.id]: e instanceof Error ? e.message : "Failed" }))
    } finally {
      setWorking(null)
    }
  }

  return (
    <>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2 -mx-1 px-1 mb-4 grid gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-auto-hide -mx-1 px-1 md:flex-wrap md:overflow-visible md:mx-0 md:px-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => reload({ filter: f.key })}
              title={f.hint}
              className={cn(
                "h-8 shrink-0 rounded-full px-3 text-[12px] font-medium transition-colors",
                filter === f.key
                  ? "bg-violet-600 text-white"
                  : "border border-border text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-auto-hide -mx-1 px-1 md:flex-wrap md:overflow-visible md:mx-0 md:px-0">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => reload({ rangeKey: r.key, from: "", to: "" })}
              className={cn(
                "h-8 shrink-0 rounded-full px-3 text-[12px] transition-colors",
                rangeKey === r.key && !customFrom && !customTo
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {r.label}
            </button>
          ))}

          <span className="inline-flex items-center gap-1 ml-1 shrink-0">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => reload({ from: e.target.value, rangeKey: "any" })}
              aria-label="From date"
              className="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-violet-500/60"
            />
            <span className="text-[12px] text-muted-foreground">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => reload({ to: e.target.value, rangeKey: "any" })}
              aria-label="To date"
              className="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-violet-500/60"
            />
          </span>

          {/* Which date the range applies to. A patent published last year and
              pulled this morning belongs in both answers, but to different
              questions, so this has to be explicit rather than assumed. */}
          <span className="inline-flex items-center rounded-md border border-border overflow-hidden ml-1 shrink-0">
            {(["published", "collected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => reload({ field: f })}
                title={
                  f === "published"
                    ? "The document's own date"
                    : "When your Researcher pulled it"
                }
                className={cn(
                  "h-8 px-2.5 text-[12px] transition-colors",
                  dateField === f
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "published" ? "Published" : "Collected"}
              </button>
            ))}
          </span>
        </div>
      </div>

      <div className="grid gap-3">
        {signals.map((s) => (
          <article
            key={s.id}
            className={cn(
              "rounded-xl border bg-card p-4 transition-colors",
              s.used_at ? "border-border/60 opacity-75" : "border-border",
            )}
          >
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full",
                  SECONDARY.has(s.lane)
                    ? "bg-muted text-muted-foreground"
                    : LANE_STYLE[s.lane] ?? "bg-violet-500/10 text-violet-700 dark:text-violet-400",
                )}
              >
                {s.lane}
              </span>
              {s.stance === "horizon" && (
                <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  trajectory
                </span>
              )}
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {whenLabel(s.published_at, s.ingested_at)}
              </span>
              {s.used_at ? (
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Check className="h-3 w-3" /> used
                </span>
              ) : s.considered_at ? (
                <span className="text-[11px] text-muted-foreground">read, not filed</span>
              ) : null}
            </div>

            <h3 className="text-[13px] font-medium text-foreground leading-snug">{s.title}</h3>

            {s.snippet && (
              <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">
                {s.snippet}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2.5">
              <button
                onClick={() => work(s)}
                disabled={working !== null}
                className="inline-flex items-center gap-1.5 h-9 md:h-7 rounded-md border border-border px-3 md:px-2.5 text-[12px] font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                {working === s.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {working === s.id ? "Working…" : "Build a story"}
              </button>
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-violet-600 dark:text-violet-400 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Source
                </a>
              )}
              {worked[s.id] && (
                <span className="text-[11px] text-muted-foreground">{worked[s.id]}</span>
              )}
            </div>
          </article>
        ))}
      </div>

      {!signals.length && !loading && (
        <div className="rounded-xl border border-dashed border-border px-4 py-6">
          <p className="text-[12px] text-muted-foreground">Nothing in this slice.</p>
        </div>
      )}

      <div ref={sentinel} className="h-10 flex items-center justify-center">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {!loading && !cursor && signals.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            That is everything the desk has collected.
          </span>
        )}
      </div>
    </>
  )
}

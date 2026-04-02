"use client"

import Link from "next/link"
import {
  Briefcase,
  FlaskConical,
  Megaphone,
  Cpu,
  ArrowUpRight,
  Circle,
  Play,
  Loader2,
  ChevronDown,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState, useCallback, useRef } from "react"
import { formatDistanceToNow } from "date-fns"
import type { LegacyAiFeedRow } from "@/lib/ai-outputs-legacy"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

type PipelineStatus = Record<string, string | null>

type Pipeline = {
  id: string
  title: string
  subtitle: string
  schedule: string
  href: string
  icon: typeof Briefcase
  accent: string
  statusKey: string
  windowHours: number
  triggerable: boolean
  triggerNote?: string
}

type FeedSnapshot = {
  brief: LegacyAiFeedRow | null
  leads: LegacyAiFeedRow[]
  radar: LegacyAiFeedRow | null
  contentQueue: LegacyAiFeedRow[]
}

const PIPELINES: Pipeline[] = [
  {
    id: "cbs",
    title: "Daily brief",
    subtitle: "News, research, and regulation filtered by your company context.",
    schedule: "Scheduled · ~05:00 daily",
    href: "/dashboard/team/cbs",
    icon: Briefcase,
    accent: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    statusKey: "cbs",
    windowHours: 26,
    triggerable: true,
  },
  {
    id: "cro",
    title: "Lead & job scan",
    subtitle: "Jack & Jill list from Context, then HN hiring and Remotive; ICP fit scoring.",
    schedule: "Scheduled · every 6h",
    href: "/dashboard/team/cro",
    icon: FlaskConical,
    accent: "text-sky-600 bg-sky-500/10 border-sky-500/20",
    statusKey: "cro",
    windowHours: 7,
    triggerable: true,
  },
  {
    id: "cto",
    title: "Tech radar",
    subtitle: "arXiv + HN → trends and technical post suggestions.",
    schedule: "Scheduled · ~06:00 daily",
    href: "/dashboard/team",
    icon: Cpu,
    accent: "text-violet-600 bg-violet-500/10 border-violet-500/20",
    statusKey: "cto",
    windowHours: 26,
    triggerable: false,
    triggerNote: "Scheduled only · runs ~06:00",
  },
  {
    id: "cmo",
    title: "Content queue",
    subtitle: "LinkedIn drafts and comments; triggered after the daily brief.",
    schedule: "08:00 · 12:00 · 16:00 weekdays",
    href: "/dashboard/team/cmo",
    icon: Megaphone,
    accent: "text-rose-600 bg-rose-500/10 border-rose-500/20",
    statusKey: "cmo",
    windowHours: 9,
    triggerable: false,
    triggerNote: "Chains from CBS brief",
  },
]

function statusDot(lastRun: string | null, windowHours: number) {
  if (!lastRun) return "none"
  const ageHours = (Date.now() - new Date(lastRun).getTime()) / 3_600_000
  if (ageHours <= windowHours) return "green"
  if (ageHours <= windowHours * 2) return "amber"
  return "red"
}

function stripMdPreview(s: string, max = 240): string {
  const t = s
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\n+/g, " ")
    .trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function dashboardItemCount(dashboard: unknown): number {
  if (!dashboard || typeof dashboard !== "object") return 0
  const d = dashboard as Record<string, unknown>
  let n = 0
  for (const k of ["breaking", "ai_tools", "research", "competitors", "funding"] as const) {
    const arr = d[k]
    if (Array.isArray(arr)) n += arr.length
  }
  return n
}

function firstHeadlineFromDashboard(dashboard: unknown): string | null {
  if (!dashboard || typeof dashboard !== "object") return null
  const d = dashboard as Record<string, unknown[]>
  for (const k of ["breaking", "competitors", "funding", "ai_tools", "research"] as const) {
    const items = d[k]
    const first = items?.[0] as { headline?: string; title?: string } | undefined
    const h = first?.headline ?? first?.title
    if (typeof h === "string" && h.trim()) return h.trim()
  }
  return null
}

type TrendRow = { trend?: string; relevance?: string; action?: string }

function parseLeadsSorted(leads: LegacyAiFeedRow[]) {
  return [...leads]
    .filter((r) => r.type === "lead_discovered")
    .map((r) => {
      const c = r.content as {
        company?: unknown
        role?: unknown
        url?: unknown
        score?: unknown
        pitchAngle?: unknown
      }
      const score = typeof c.score === "number" ? c.score : Number(c.score) || 0
      return {
        id: r.id,
        company: String(c.company ?? "Company"),
        role: String(c.role ?? "Role"),
        url: typeof c.url === "string" && c.url.startsWith("http") ? c.url : null,
        score,
        why: String(c.pitchAngle ?? "").trim(),
      }
    })
    .sort((a, b) => b.score - a.score)
}

// Live run log lines shown while polling
/** Must stay aligned with `lib/inngest/functions/cbs/daily-brief.ts` (steps are illustrative; UI advances on a timer while the job runs). */
const LOG_LINES: Record<string, string[]> = {
  cbs: [
    "Fetching company context…",
    "Scraping RSS & news feeds (CBS sources)…",
    "Scraping arXiv for relevant papers…",
    "Scraping Hacker News…",
    "Merging & applying 24h window…",
    "Scoring items against your company context…",
    "Saving competitor & funding signals (persistent)…",
    "Loading strategic competitor + funding context…",
    "Formatting brief (including recap sections)…",
    "Saving to database…",
    "Writing daily brief & competitor vault (Obsidian)…",
    "Finished. Open Signal feed.",
  ],
  cro: [
    "Fetching company context…",
    "Loading Jack & Jill roles from Context…",
    "Scraping HN Who's Hiring…",
    "Scraping Remotive job board…",
    "Scanning Reddit for intent signals…",
    "Scoring leads & intent threads for ICP fit…",
    "Saving qualified leads & hot intent signals…",
    "Drafting outreach for top leads…",
    "Done — check Content queue & intent signals ↓",
  ],
}

function PipelineLatestOutput({
  pipelineId,
  feed,
}: {
  pipelineId: string
  feed: FeedSnapshot | null
}) {
  if (!feed) return null

  if (pipelineId === "cbs") {
    const brief = feed.brief
    if (!brief || brief.type !== "daily_brief") {
      return (
        <p className="text-[11px] text-muted-foreground/80 italic border border-dashed border-border rounded-md px-2 py-1.5 bg-muted/20">
          No brief saved yet — run the pipeline or wait for the daily schedule.
        </p>
      )
    }
    const dash = brief.content?.dashboard
    const md = brief.content?.markdown
    const n = dashboardItemCount(dash)
    const headline = firstHeadlineFromDashboard(dash)
    const text =
      headline ??
      (typeof md === "string" && md.trim() ? stripMdPreview(md, 280) : null) ??
      "Brief ready. Open Signal feed for full sections."

    return (
      <Collapsible defaultOpen className="space-y-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/25 px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180 transition-colors">
          <span>Latest brief preview</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 text-[12px] text-foreground/90 leading-relaxed">
          {n > 0 && (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80">{n}</span> scored items across Signal feed sections
              {brief.created_at ? (
                <span className="text-muted-foreground/70">
                  {" "}
                  · {formatDistanceToNow(new Date(brief.created_at), { addSuffix: true })}
                </span>
              ) : null}
            </p>
          )}
          <p className="border-l-2 border-amber-500/35 pl-2">{text}</p>
          <p className="text-[11px] text-muted-foreground">
            Full brief (competitors, funding, actions) is in the{" "}
            <span className="text-foreground/90">Signal feed</span> column.
          </p>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  if (pipelineId === "cro") {
    const rows = parseLeadsSorted(feed.leads)
    if (rows.length === 0) {
      return (
        <p className="text-[11px] text-muted-foreground/80 italic border border-dashed border-border rounded-md px-2 py-1.5 bg-muted/20">
          No leads saved yet — run a scan. When jobs finish, who to pursue and why (ICP angle) appears here.
        </p>
      )
    }
    return (
      <Collapsible defaultOpen className="space-y-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/25 px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180 transition-colors">
          <span>
            Who to pursue ({rows.length} lead{rows.length === 1 ? "" : "s"})
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-border/70 bg-background/80 px-2.5 py-2 text-[12px] leading-snug"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {r.company}
                      <span className="font-normal text-muted-foreground"> · {r.role}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      <span className="font-medium text-foreground/85">Why: </span>
                      {r.why || "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[11px] font-semibold tabular-nums text-sky-700 dark:text-sky-400">
                      {r.score}/10
                    </span>
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-primary inline-flex items-center gap-0.5 hover:underline"
                      >
                        Link <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  if (pipelineId === "cto") {
    const radar = feed.radar
    if (!radar || radar.type !== "tech_radar") {
      return (
        <p className="text-[11px] text-muted-foreground/80 italic border border-dashed border-border rounded-md px-2 py-1.5 bg-muted/20">
          No tech radar run yet — runs on the daily schedule.
        </p>
      )
    }
    const raw = radar.content?.trends
    const trends: TrendRow[] = Array.isArray(raw) ? (raw as TrendRow[]) : []
    const sources =
      typeof radar.content?.sourcesScanned === "number" ? radar.content.sourcesScanned : null
    const mdSum =
      typeof radar.content?.markdownSummary === "string" ? radar.content.markdownSummary.trim() : ""
    const preview =
      trends[0]?.trend && trends[0]?.relevance
        ? `${trends[0].trend}: ${trends[0].relevance}`
        : mdSum
          ? stripMdPreview(mdSum, 220)
          : null

    return (
      <Collapsible defaultOpen className="space-y-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/25 px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180 transition-colors">
          <span>Latest radar</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 text-[12px]">
          {sources != null && (
            <p className="text-[11px] text-muted-foreground">
              Sources scanned: <span className="font-medium text-foreground/85">{sources}</span>
            </p>
          )}
          {preview && <p className="border-l-2 border-violet-500/35 pl-2 text-foreground/90 leading-relaxed">{preview}</p>}
          {trends.length > 1 && (
            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
              {trends.slice(1, 5).map((t, i) => (
                <li key={i} className="list-disc list-inside">
                  <span className="text-foreground/90 font-medium">{t.trend ?? "Trend"}</span>
                  {t.relevance ? <span> — {t.relevance}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </CollapsibleContent>
      </Collapsible>
    )
  }

  if (pipelineId === "cmo") {
    const q = feed.contentQueue ?? []
    if (q.length === 0) {
      return (
        <p className="text-[11px] text-muted-foreground/80 italic border border-dashed border-border rounded-md px-2 py-1.5 bg-muted/20">
          No drafts in queue — content appears after the daily brief runs and the CMO pipeline posts drafts.
        </p>
      )
    }
    const preview = q.slice(0, 4)

    return (
      <Collapsible defaultOpen className="space-y-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/25 px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180 transition-colors">
          <span>
            Drafts & outreach ({q.length})
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2">
          <ul className="space-y-2">
            {preview.map((row) => {
              const c = row.content as { angle?: string; body?: string; contentType?: string; status?: string }
              const title =
                row.type === "content_linkedin" || row.type === "content_technical"
                  ? `${c.contentType ?? "item"} · ${c.status ?? "draft"}`
                  : row.type
              const snippet = stripMdPreview(
                (typeof c.angle === "string" && c.angle ? c.angle : c.body) ?? "",
                160,
              )
              return (
                <li
                  key={row.id}
                  className="rounded-md border border-border/70 bg-background/80 px-2.5 py-2 text-[11px] leading-snug"
                >
                  <p className="font-medium text-foreground/95 capitalize">{title}</p>
                  {snippet ? <p className="text-muted-foreground mt-1">{snippet}</p> : null}
                </li>
              )
            })}
          </ul>
          {q.length > 4 && (
            <p className="text-[11px] text-muted-foreground">See full queue below ↓</p>
          )}
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return null
}

export function IntelligencePipelines() {
  const [status, setStatus] = useState<PipelineStatus>({})
  const [feed, setFeed] = useState<FeedSnapshot | null>(null)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [triggerResult, setTriggerResult] = useState<{ id: string; msg: string; ok: boolean } | null>(null)

  // Live run state
  const [activeRun, setActiveRun] = useState<{ pipeline: string; startedAt: number } | null>(null)
  const [logIndex, setLogIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchFeed = useCallback(async (): Promise<PipelineStatus> => {
    try {
      const res = await fetch("/api/intelligence/feed")
      const d = await res.json()
      const newStatus: PipelineStatus = d.pipelineStatus ?? {}
      setStatus(newStatus)
      setFeed({
        brief: d.brief ?? null,
        leads: d.leads ?? [],
        radar: d.radar ?? null,
        contentQueue: d.contentQueue ?? [],
      })
      return newStatus
    } catch {
      return {}
    }
  }, [])

  useEffect(() => {
    fetchFeed()
  }, [fetchFeed])

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (logRef.current) clearInterval(logRef.current)
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    pollRef.current = null
    logRef.current = null
    elapsedRef.current = null
    setActiveRun(null)
    setLogIndex(0)
    setElapsed(0)
  }, [])

  const startPolling = useCallback(
    (pipeline: string, previousStatus: PipelineStatus) => {
      const startedAt = Date.now()
      setActiveRun({ pipeline, startedAt })
      setLogIndex(0)
      setElapsed(0)

      const lines = LOG_LINES[pipeline] ?? []
      let li = 0
      logRef.current = setInterval(() => {
        li = Math.min(li + 1, lines.length - 1)
        setLogIndex(li)
      }, 8_000)

      elapsedRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000))
      }, 1_000)

      let attempts = 0
      pollRef.current = setInterval(async () => {
        attempts++
        const newStatus = await fetchFeed()
        const prevTs = previousStatus[pipeline]
        const newTs = newStatus[pipeline]

        const changed = newTs && newTs !== prevTs
        const timeout = attempts >= 22

        if (changed || timeout) {
          stopPolling()
          await fetchFeed()
          if (changed) {
            setTriggerResult({
              id: pipeline,
              msg:
                pipeline === "cbs"
                  ? "Brief run finished — Signal feed and this card are updated. CMO drafts may appear below shortly."
                  : "Lead scan saved — qualified leads and angles are shown in this card above.",
              ok: true,
            })
          } else {
            setTriggerResult({
              id: pipeline,
              msg: "Still running. Wait a minute and refresh; the feed updates when the job finishes.",
              ok: false,
            })
          }
        }
      }, 8_000)
    },
    [fetchFeed, stopPolling],
  )

  useEffect(() => () => stopPolling(), [stopPolling])

  const handleTrigger = async (pipeline: string) => {
    setTriggering(pipeline)
    setTriggerResult(null)

    const previousStatus = await fetchFeed()

    try {
      const res = await fetch("/api/intelligence/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline }),
      })
      const data = await res.json()
      if (res.ok) {
        startPolling(pipeline, previousStatus)
      } else {
        setTriggerResult({ id: pipeline, msg: data.error ?? "Failed to trigger", ok: false })
      }
    } catch {
      setTriggerResult({ id: pipeline, msg: "Could not reach server", ok: false })
    } finally {
      setTriggering(null)
    }
  }

  const runningPipeline = activeRun?.pipeline
  const logLines = runningPipeline ? LOG_LINES[runningPipeline] ?? [] : []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Automated reporting</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Results appear in Signal feed and the cards below; expand a card for the latest run.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/team"
            className="text-[12px] text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
          >
            My team
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {activeRun && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-[13px] font-medium text-foreground">
                {PIPELINES.find((p) => p.id === activeRun.pipeline)?.title} running…
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground tabular-nums">{elapsed}s elapsed</span>
            </div>
          </div>

          <div className="space-y-1">
            {logLines.map((line, i) => {
              const done = i < logIndex
              const active = i === logIndex
              const pending = i > logIndex
              return (
                <div key={i} className={cn("flex items-center gap-2 text-[12px]", pending && "opacity-30")}>
                  {done ? (
                    <Circle className="h-1.5 w-1.5 fill-emerald-500 text-emerald-500 shrink-0" />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                  ) : (
                    <Circle className="h-1.5 w-1.5 text-muted-foreground/30 shrink-0" />
                  )}
                  <span
                    className={cn(
                      done ? "text-muted-foreground line-through" : active ? "text-foreground font-medium" : "text-muted-foreground",
                    )}
                  >
                    {line}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {triggerResult && !activeRun && (
        <div
          className={cn(
            "text-[13px] px-3 py-2 rounded-md",
            triggerResult.ok
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              : "bg-amber-500/10 text-amber-600 border border-amber-500/20",
          )}
        >
          {triggerResult.msg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PIPELINES.map((p) => {
          const lastRun = status[p.statusKey] ?? null
          const dot = statusDot(lastRun, p.windowHours)
          const dotColor =
            dot === "green"
              ? "text-emerald-500"
              : dot === "amber"
                ? "text-amber-500"
                : dot === "red"
                  ? "text-rose-500"
                  : "text-muted-foreground/30"
          const lastRunLabel = lastRun
            ? formatDistanceToNow(new Date(lastRun), { addSuffix: true })
            : "Never run"
          const isTriggering = triggering === p.id
          const isRunning = runningPipeline === p.id

          return (
            <div
              key={p.id}
              className={cn(
                "rounded-lg border bg-card p-4 transition-colors flex flex-col gap-3",
                isRunning ? "border-primary/40 bg-primary/5" : "border-border",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", p.accent)}>
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <p.icon className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={p.href} className="text-[13px] font-semibold text-foreground hover:text-primary truncate">
                      {p.title}
                    </Link>
                    <Circle
                      className={cn("h-2 w-2 fill-current shrink-0", isRunning ? "text-primary animate-pulse" : dotColor)}
                    />
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-snug mt-1 line-clamp-2">{p.subtitle}</p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <p className="text-[11px] text-muted-foreground/80">{p.schedule}</p>
                    <p className="text-[11px] text-muted-foreground/60 shrink-0">
                      {isRunning ? "Running now…" : lastRunLabel}
                    </p>
                  </div>
                </div>
              </div>

              <PipelineLatestOutput pipelineId={p.id} feed={feed} />

              <div>
                {p.triggerable ? (
                  <button
                    type="button"
                    onClick={() => handleTrigger(p.id)}
                    disabled={isTriggering || isRunning || triggering !== null || activeRun !== null}
                    className={cn(
                      "flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors",
                      isRunning
                        ? "bg-primary/10 text-primary cursor-default"
                        : "bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    {isRunning || isTriggering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {isRunning ? "Running…" : isTriggering ? "Starting…" : "Run now"}
                  </button>
                ) : (
                  <p className="text-[11px] text-muted-foreground/50 italic">{p.triggerNote}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowUpRight,
  Briefcase,
  ChevronDown,
  Circle,
  Cpu,
  FlaskConical,
  Loader2,
  Play,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { formatDistanceToNow } from "date-fns"
import type { LegacyAiFeedRow } from "@/lib/ai-outputs-legacy"
import type { RedditBehavioralSummary } from "@/lib/juno/reddit-recon"
import { cn } from "@/lib/utils"
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

type BehavioralSnapshot = {
  id: string
  created_at: string
  summary: RedditBehavioralSummary
  conversationCount: number
  subreddits: string[]
  latestSignalAt: string | null
}

type FeedSnapshot = {
  brief: LegacyAiFeedRow | null
  leads: LegacyAiFeedRow[]
  behavioralUpdates: BehavioralSnapshot | null
  radar: LegacyAiFeedRow | null
}

const PIPELINES: Pipeline[] = [
  {
    id: "cbs",
    title: "Daily brief",
    subtitle: "News, research, and regulation filtered by your company context.",
    schedule: "Scheduled - ~05:00 daily",
    href: "/dashboard/team/cbs",
    icon: Briefcase,
    accent: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    statusKey: "cbs",
    windowHours: 26,
    triggerable: true,
  },
  {
    id: "intent",
    title: "Behavioral updates",
    subtitle: "Reddit customer research across target subreddits: pains, workarounds, buying behavior, and switching forces.",
    schedule: "Scheduled - every 6h",
    href: "/dashboard#behavioral-updates",
    icon: FlaskConical,
    accent: "text-sky-600 bg-sky-500/10 border-sky-500/20",
    statusKey: "intent",
    windowHours: 7,
    triggerable: true,
  },
  {
    id: "cto",
    title: "Tech radar",
    subtitle: "arXiv + HN to trends and technical post suggestions.",
    schedule: "Scheduled - ~06:00 daily",
    href: "/dashboard/team",
    icon: Cpu,
    accent: "text-violet-600 bg-violet-500/10 border-violet-500/20",
    statusKey: "cto",
    windowHours: 26,
    triggerable: false,
    triggerNote: "Scheduled only - runs ~06:00",
  },
]

function PipelineTitleLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const hashIdx = href.indexOf("#")
  const pathOnly = hashIdx >= 0 ? href.slice(0, hashIdx) : href
  const hash = hashIdx >= 0 ? href.slice(hashIdx + 1) : ""

  if (hash && pathOnly === "/dashboard") {
    return (
      <Link
        href={href}
        scroll={false}
        className={className}
        onClick={(e) => {
          if (pathname === "/dashboard") {
            e.preventDefault()
            document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" })
            window.history.replaceState(null, "", `#${hash}`)
          }
        }}
      >
        {children}
      </Link>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

const LOG_LINES: Record<string, string[]> = {
  cbs: [
    "Fetching company context...",
    "Scraping RSS and news feeds...",
    "Scraping arXiv and Hacker News...",
    "Merging and scoring the last 24 hours...",
    "Saving competitor and funding context...",
    "Formatting the brief...",
    "Saving the run and updating the vault...",
    "Finished. Open Signal feed.",
  ],
  intent: [
    "Fetching company context...",
    "Scanning Reddit for intent signals...",
    "Scoring threads against your ICP and product context...",
    "Synthesizing customer behavior and switching forces...",
    "Saving behavioral updates and thread evidence...",
    "Finished. Open Behavioral updates below.",
  ],
}

type TrendRow = { trend?: string; relevance?: string; action?: string }

function statusDot(lastRun: string | null, windowHours: number) {
  if (!lastRun) return "none"
  const ageHours = (Date.now() - new Date(lastRun).getTime()) / 3_600_000
  if (ageHours <= windowHours) return "green"
  if (ageHours <= windowHours * 2) return "amber"
  return "red"
}

function stripMdPreview(value: string, max = 240) {
  const normalized = value
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\n+/g, " ")
    .trim()
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized
}

function dashboardItemCount(dashboard: unknown): number {
  if (!dashboard || typeof dashboard !== "object") return 0
  const record = dashboard as Record<string, unknown>
  let count = 0
  for (const key of ["breaking", "ai_tools", "research", "competitors", "funding"] as const) {
    const rows = record[key]
    if (Array.isArray(rows)) count += rows.length
  }
  return count
}

function firstHeadlineFromDashboard(dashboard: unknown): string | null {
  if (!dashboard || typeof dashboard !== "object") return null
  const record = dashboard as Record<string, unknown[]>
  for (const key of ["breaking", "competitors", "funding", "ai_tools", "research"] as const) {
    const items = record[key]
    const first = items?.[0] as { headline?: string; title?: string } | undefined
    const headline = first?.headline ?? first?.title
    if (typeof headline === "string" && headline.trim()) return headline.trim()
  }
  return null
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
        <p className="rounded-md border border-dashed border-border bg-muted/20 px-2 py-1.5 text-[11px] italic text-muted-foreground/80">
          No brief saved yet. Run the pipeline or wait for the daily schedule.
        </p>
      )
    }

    const dashboard = brief.content?.dashboard
    const markdown = brief.content?.markdown
    const count = dashboardItemCount(dashboard)
    const headline = firstHeadlineFromDashboard(dashboard)
    const preview =
      headline ??
      (typeof markdown === "string" && markdown.trim() ? stripMdPreview(markdown, 280) : null) ??
      "Brief ready. Open Signal feed for full sections."

    return (
      <Collapsible defaultOpen className="space-y-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/25 px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180">
          <span>Latest brief preview</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 text-[12px] leading-relaxed text-foreground/90">
          {count > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80">{count}</span> scored items across Signal feed sections
              {brief.created_at ? (
                <span className="text-muted-foreground/70">
                  {" "}
                  - {formatDistanceToNow(new Date(brief.created_at), { addSuffix: true })}
                </span>
              ) : null}
            </p>
          ) : null}
          <p className="border-l-2 border-amber-500/35 pl-2">{preview}</p>
          <p className="text-[11px] text-muted-foreground">
            Full brief is in the <span className="text-foreground/90">Signal feed</span> column.
          </p>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  if (pipelineId === "intent") {
    const research = feed.behavioralUpdates
    if (!research) {
      return (
        <p className="rounded-md border border-dashed border-border bg-muted/20 px-2 py-1.5 text-[11px] italic text-muted-foreground/80">
          No behavioral snapshot saved yet. Run the Reddit scan and the latest customer research will appear here.
        </p>
      )
    }

    const leadSubreddit =
      research.subreddits.length > 0 ? `r/${research.subreddits.slice(0, 3).join(", r/")}` : "recent subreddits"
    const topPush = research.summary.pushOfPresent[0] ?? null
    const topPain = research.summary.painPoints[0] ?? null

    return (
      <Collapsible defaultOpen className="space-y-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/25 px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180">
          <span>
            Behavioral read ({research.conversationCount} thread{research.conversationCount === 1 ? "" : "s"})
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 text-[12px] leading-relaxed text-foreground/90">
          <p className="text-[11px] text-muted-foreground">
            Latest synthesis from <span className="font-medium text-foreground/85">{leadSubreddit}</span>
            {research.latestSignalAt ? (
              <span className="text-muted-foreground/70">
                {" "}
                - {formatDistanceToNow(new Date(research.latestSignalAt), { addSuffix: true })}
              </span>
            ) : null}
          </p>
          <p className="border-l-2 border-sky-500/35 pl-2">{research.summary.overview}</p>
          {topPush ? (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/85">Push:</span> {topPush}
            </p>
          ) : null}
          {topPain ? (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/85">Pain:</span> {topPain}
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Open <span className="text-foreground/90">Behavioral updates</span> below for subreddit filters,
            switching forces, and raw thread evidence.
          </p>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  if (pipelineId === "cto") {
    const radar = feed.radar
    if (!radar || radar.type !== "tech_radar") {
      return (
        <p className="rounded-md border border-dashed border-border bg-muted/20 px-2 py-1.5 text-[11px] italic text-muted-foreground/80">
          No tech radar run yet. It runs on the daily schedule.
        </p>
      )
    }

    const rawTrends = radar.content?.trends
    const trends: TrendRow[] = Array.isArray(rawTrends) ? (rawTrends as TrendRow[]) : []
    const sources =
      typeof radar.content?.sourcesScanned === "number" ? radar.content.sourcesScanned : null
    const markdownSummary =
      typeof radar.content?.markdownSummary === "string" ? radar.content.markdownSummary.trim() : ""
    const preview =
      trends[0]?.trend && trends[0]?.relevance
        ? `${trends[0].trend}: ${trends[0].relevance}`
        : markdownSummary
          ? stripMdPreview(markdownSummary, 220)
          : null

    return (
      <Collapsible defaultOpen className="space-y-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/25 px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 [&[data-state=open]>svg]:rotate-180">
          <span>Latest radar</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 text-[12px]">
          {sources != null ? (
            <p className="text-[11px] text-muted-foreground">
              Sources scanned: <span className="font-medium text-foreground/85">{sources}</span>
            </p>
          ) : null}
          {preview ? (
            <p className="border-l-2 border-violet-500/35 pl-2 leading-relaxed text-foreground/90">{preview}</p>
          ) : null}
          {trends.length > 1 ? (
            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
              {trends.slice(1, 5).map((trend, index) => (
                <li key={`${trend.trend ?? "trend"}-${index}`} className="list-disc list-inside">
                  <span className="font-medium text-foreground/90">{trend.trend ?? "Trend"}</span>
                  {trend.relevance ? <span> - {trend.relevance}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
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
  const [activeRun, setActiveRun] = useState<{ pipeline: string; startedAt: number } | null>(null)
  const [logIndex, setLogIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchFeed = useCallback(async (): Promise<PipelineStatus> => {
    try {
      const res = await fetch("/api/intelligence/feed")
      const json = await res.json()
      const nextStatus: PipelineStatus = json.pipelineStatus ?? {}
      setStatus(nextStatus)
      setFeed({
        brief: json.brief ?? null,
        leads: json.leads ?? [],
        behavioralUpdates: json.behavioralUpdates ?? null,
        radar: json.radar ?? null,
      })
      return nextStatus
    } catch {
      return {}
    }
  }, [])

  useEffect(() => {
    void fetchFeed()
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
      let currentIndex = 0
      logRef.current = setInterval(() => {
        currentIndex = Math.min(currentIndex + 1, Math.max(lines.length - 1, 0))
        setLogIndex(currentIndex)
      }, 8_000)

      elapsedRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000))
      }, 1_000)

      let attempts = 0
      pollRef.current = setInterval(async () => {
        attempts += 1
        const nextStatus = await fetchFeed()
        const previousTimestamp = previousStatus[pipeline]
        const nextTimestamp = nextStatus[pipeline]
        const changed = Boolean(nextTimestamp && nextTimestamp !== previousTimestamp)
        const timedOut = attempts >= 22

        if (!changed && !timedOut) return

        stopPolling()
        await fetchFeed()

        if (changed) {
          const successMessage =
            pipeline === "cbs"
              ? "Brief run finished. Signal feed and this card are updated."
              : pipeline === "intent"
                ? "Behavioral updates refreshed. Reddit customer research and thread evidence are updated below."
                : "Run finished and the card has been updated."

          setTriggerResult({ id: pipeline, msg: successMessage, ok: true })
          return
        }

        setTriggerResult({
          id: pipeline,
          msg: "Still running. Wait a minute and refresh; the feed updates when the job finishes.",
          ok: false,
        })
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
      const json = await res.json()

      if (res.ok) {
        startPolling(pipeline, previousStatus)
      } else {
        setTriggerResult({ id: pipeline, msg: json.error ?? "Failed to trigger", ok: false })
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
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Results appear in Signal feed and the cards below. Expand a card for the latest run.
          </p>
        </div>
        <Link
          href="/dashboard/team"
          className="flex shrink-0 items-center gap-1 text-[12px] text-primary hover:text-primary/80"
        >
          My team
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {activeRun ? (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-[13px] font-medium text-foreground">
                {PIPELINES.find((pipeline) => pipeline.id === activeRun.pipeline)?.title} running...
              </span>
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground">{elapsed}s elapsed</span>
          </div>

          <div className="space-y-1">
            {logLines.map((line, index) => {
              const done = index < logIndex
              const active = index === logIndex
              const pending = index > logIndex

              return (
                <div key={`${line}-${index}`} className={cn("flex items-center gap-2 text-[12px]", pending && "opacity-30")}>
                  {done ? (
                    <Circle className="h-1.5 w-1.5 shrink-0 fill-emerald-500 text-emerald-500" />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Circle className="h-1.5 w-1.5 shrink-0 text-muted-foreground/30" />
                  )}
                  <span
                    className={cn(
                      done
                        ? "line-through text-muted-foreground"
                        : active
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {line}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {triggerResult && !activeRun ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-[13px]",
            triggerResult.ok
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
              : "border-amber-500/20 bg-amber-500/10 text-amber-600",
          )}
        >
          {triggerResult.msg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PIPELINES.map((pipeline) => {
          const lastRun = status[pipeline.statusKey] ?? null
          const dot = statusDot(lastRun, pipeline.windowHours)
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
          const isTriggering = triggering === pipeline.id
          const isRunning = runningPipeline === pipeline.id

          return (
            <div
              key={pipeline.id}
              className={cn(
                "flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors",
                isRunning ? "border-primary/40 bg-primary/5" : "border-border",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", pipeline.accent)}>
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <pipeline.icon className="h-4 w-4" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <PipelineTitleLink
                      href={pipeline.href}
                      className="truncate text-[13px] font-semibold text-foreground hover:text-primary"
                    >
                      {pipeline.title}
                    </PipelineTitleLink>
                    <Circle
                      className={cn(
                        "h-2 w-2 shrink-0 fill-current",
                        isRunning ? "animate-pulse text-primary" : dotColor,
                      )}
                    />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                    {pipeline.subtitle}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground/80">{pipeline.schedule}</p>
                    <p className="shrink-0 text-[11px] text-muted-foreground/60">
                      {isRunning ? "Running now..." : lastRunLabel}
                    </p>
                  </div>
                </div>
              </div>

              <PipelineLatestOutput pipelineId={pipeline.id} feed={feed} />

              <div>
                {pipeline.triggerable ? (
                  <button
                    type="button"
                    onClick={() => void handleTrigger(pipeline.id)}
                    disabled={isTriggering || isRunning || triggering !== null || activeRun !== null}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                      isRunning
                        ? "cursor-default bg-primary/10 text-primary"
                        : "bg-primary/10 text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    {isRunning || isTriggering ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    {isRunning ? "Running..." : isTriggering ? "Starting..." : "Run now"}
                  </button>
                ) : (
                  <p className="text-[11px] italic text-muted-foreground/50">{pipeline.triggerNote}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState, useCallback, useRef } from "react"
import { formatDistanceToNow } from "date-fns"

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

const PIPELINES: Pipeline[] = [
  {
    id: "cbs",
    title: "Daily brief",
    subtitle: "Scored news, research, regulation — tuned to your company context.",
    schedule: "Cron · 05:00 daily",
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
    subtitle: "HN hiring + Remotive — ICP fit scoring, qualified leads surfaced.",
    schedule: "Cron · every 6h",
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
    schedule: "Cron · 06:00 daily",
    href: "/dashboard/team",
    icon: Cpu,
    accent: "text-violet-600 bg-violet-500/10 border-violet-500/20",
    statusKey: "cto",
    windowHours: 26,
    triggerable: false,
    triggerNote: "Cron only · runs at 06:00",
  },
  {
    id: "cmo",
    title: "Content queue",
    subtitle: "LinkedIn drafts, comments, outreach — chains from CBS brief automatically.",
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

const INNGEST_DASHBOARD = "https://app.inngest.com/functions"

function statusDot(lastRun: string | null, windowHours: number) {
  if (!lastRun) return "none"
  const ageHours = (Date.now() - new Date(lastRun).getTime()) / 3_600_000
  if (ageHours <= windowHours) return "green"
  if (ageHours <= windowHours * 2) return "amber"
  return "red"
}

// Live run log lines shown while polling
const LOG_LINES: Record<string, string[]> = {
  cbs: [
    "Fetching company context…",
    "Scraping arXiv for relevant papers…",
    "Scraping Hacker News…",
    "Scraping news sources…",
    "Scraping ProductHunt…",
    "Scraping regulatory sources…",
    "Scoring items against your company context…",
    "Formatting brief…",
    "Saving to database…",
    "Done — check Signal feed →",
  ],
  cro: [
    "Fetching company context…",
    "Scraping HN Who's Hiring…",
    "Scraping Remotive job board…",
    "Scoring leads for ICP fit…",
    "Saving qualified leads…",
    "Generating outreach copy for top leads…",
    "Done — check Content queue ↓",
  ],
}

export function IntelligencePipelines() {
  const [status, setStatus] = useState<PipelineStatus>({})
  const [triggering, setTriggering] = useState<string | null>(null)
  const [triggerResult, setTriggerResult] = useState<{ id: string; msg: string; ok: boolean } | null>(null)

  // Live run state
  const [activeRun, setActiveRun] = useState<{ pipeline: string; startedAt: number } | null>(null)
  const [logIndex, setLogIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/intelligence/feed")
      const d = await res.json()
      const newStatus: PipelineStatus = d.pipelineStatus ?? {}
      setStatus(newStatus)
      return newStatus
    } catch {
      return {}
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

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

  const startPolling = useCallback((pipeline: string, previousStatus: PipelineStatus) => {
    const startedAt = Date.now()
    setActiveRun({ pipeline, startedAt })
    setLogIndex(0)
    setElapsed(0)

    // Advance log lines every ~8s
    const lines = LOG_LINES[pipeline] ?? []
    let li = 0
    logRef.current = setInterval(() => {
      li = Math.min(li + 1, lines.length - 1)
      setLogIndex(li)
    }, 8_000)

    // Elapsed timer every second
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1_000)

    // Poll DB every 8s for up to 3 minutes
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      const newStatus = await fetchStatus()
      const prevTs = previousStatus[pipeline]
      const newTs = newStatus[pipeline]

      const changed = newTs && newTs !== prevTs
      const timeout = attempts >= 22 // 22 × 8s = ~3 min

      if (changed || timeout) {
        stopPolling()
        if (changed) {
          setTriggerResult({
            id: pipeline,
            msg: pipeline === "cbs"
              ? "Brief generated — Signal feed updated. CMO content drafts will appear below shortly."
              : "Lead scan complete — check Content queue below.",
            ok: true,
          })
        } else {
          setTriggerResult({
            id: pipeline,
            msg: "Still running — check Inngest dashboard for live logs.",
            ok: false,
          })
        }
      }
    }, 8_000)
  }, [fetchStatus, stopPolling])

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling])

  const handleTrigger = async (pipeline: string) => {
    setTriggering(pipeline)
    setTriggerResult(null)

    const previousStatus = await fetchStatus()

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
            Background jobs run on your profile — outputs land in the feed and content queue below.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={INNGEST_DASHBOARD}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
          >
            Run logs
            <ExternalLink className="h-3 w-3" />
          </a>
          <Link
            href="/dashboard/team"
            className="text-[12px] text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
          >
            My team
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Live run monitor */}
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
              <a
                href={INNGEST_DASHBOARD}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-0.5"
              >
                Full logs <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>

          {/* Step log */}
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
                  <span className={cn(done ? "text-muted-foreground line-through" : active ? "text-foreground font-medium" : "text-muted-foreground")}>
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
            dot === "green" ? "text-emerald-500"
            : dot === "amber" ? "text-amber-500"
            : dot === "red" ? "text-rose-500"
            : "text-muted-foreground/30"
          const lastRunLabel = lastRun
            ? formatDistanceToNow(new Date(lastRun), { addSuffix: true })
            : "Never run"
          const isTriggering = triggering === p.id
          const isRunning = runningPipeline === p.id

          return (
            <div key={p.id} className={cn(
              "rounded-lg border bg-card p-4 transition-colors",
              isRunning ? "border-primary/40 bg-primary/5" : "border-border",
            )}>
              <div className="flex items-start gap-3">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", p.accent)}>
                  {isRunning
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <p.icon className="h-4 w-4" />
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={p.href} className="text-[13px] font-semibold text-foreground hover:text-primary truncate">
                      {p.title}
                    </Link>
                    <Circle className={cn("h-2 w-2 fill-current shrink-0", isRunning ? "text-primary animate-pulse" : dotColor)} />
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-snug mt-1 line-clamp-2">{p.subtitle}</p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <p className="text-[11px] text-muted-foreground/80">{p.schedule}</p>
                    <p className="text-[11px] text-muted-foreground/60 shrink-0">
                      {isRunning ? "Running now…" : lastRunLabel}
                    </p>
                  </div>

                  <div className="mt-3">
                    {p.triggerable ? (
                      <button
                        onClick={() => handleTrigger(p.id)}
                        disabled={isTriggering || isRunning || triggering !== null || activeRun !== null}
                        className={cn(
                          "flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors",
                          isRunning
                            ? "bg-primary/10 text-primary cursor-default"
                            : "bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed",
                        )}
                      >
                        {isRunning || isTriggering
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Play className="h-3 w-3" />}
                        {isRunning ? "Running…" : isTriggering ? "Starting…" : "Run now"}
                      </button>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/50 italic">{p.triggerNote}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

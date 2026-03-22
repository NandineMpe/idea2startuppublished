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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState, useCallback } from "react"
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
  triggerable: boolean   // can be fired manually via /api/intelligence/trigger
  triggerNote?: string   // shown when not triggerable
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

function statusDot(lastRun: string | null, windowHours: number) {
  if (!lastRun) return "none"
  const ageHours = (Date.now() - new Date(lastRun).getTime()) / 3_600_000
  if (ageHours <= windowHours) return "green"
  if (ageHours <= windowHours * 2) return "amber"
  return "red"
}

export function IntelligencePipelines() {
  const [status, setStatus] = useState<PipelineStatus>({})
  const [triggering, setTriggering] = useState<string | null>(null)
  const [triggerResult, setTriggerResult] = useState<{ id: string; msg: string; ok: boolean } | null>(null)

  const fetchStatus = useCallback(() => {
    fetch("/api/intelligence/feed")
      .then((r) => r.json())
      .then((d) => setStatus(d.pipelineStatus ?? {}))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleTrigger = async (pipeline: string) => {
    setTriggering(pipeline)
    setTriggerResult(null)
    try {
      const res = await fetch("/api/intelligence/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline }),
      })
      const data = await res.json()
      if (res.ok) {
        setTriggerResult({
          id: pipeline,
          msg: pipeline === "cbs"
            ? "Brief requested — check back in ~60s. CMO content will generate automatically after."
            : "Job scan requested — check back in ~60s.",
          ok: true,
        })
        // Refresh status after a delay
        setTimeout(fetchStatus, 10_000)
      } else {
        setTriggerResult({ id: pipeline, msg: data.error ?? "Failed to trigger", ok: false })
      }
    } catch {
      setTriggerResult({ id: pipeline, msg: "Could not reach server", ok: false })
    } finally {
      setTriggering(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Automated reporting</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Background jobs run on your profile — outputs land in the feed and content queue below.
          </p>
        </div>
        <Link
          href="/dashboard/team"
          className="text-[12px] text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
        >
          My team
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {triggerResult && (
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

          return (
            <div
              key={p.id}
              className="group rounded-lg border bg-card p-4 border-border"
            >
              <div className="flex items-start gap-3">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", p.accent)}>
                  <p.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={p.href}
                      className="text-[13px] font-semibold text-foreground hover:text-primary truncate"
                    >
                      {p.title}
                    </Link>
                    <Circle className={cn("h-2 w-2 fill-current shrink-0", dotColor)} />
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-snug mt-1 line-clamp-2">
                    {p.subtitle}
                  </p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <p className="text-[11px] text-muted-foreground/80">{p.schedule}</p>
                    <p className="text-[11px] text-muted-foreground/60 shrink-0">{lastRunLabel}</p>
                  </div>

                  <div className="mt-3">
                    {p.triggerable ? (
                      <button
                        onClick={() => handleTrigger(p.id)}
                        disabled={isTriggering || triggering !== null}
                        className={cn(
                          "flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors",
                          "bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed",
                        )}
                      >
                        {isTriggering
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Play className="h-3 w-3" />}
                        {isTriggering ? "Running…" : "Run now"}
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

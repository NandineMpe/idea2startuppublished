"use client"

import Link from "next/link"
import {
  Briefcase,
  FlaskConical,
  Megaphone,
  Cpu,
  ArrowUpRight,
  Circle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
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
  windowHours: number // how many hours before we consider it stale
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
  },
  {
    id: "cmo",
    title: "Content queue",
    subtitle: "LinkedIn drafts, comments, outreach — pending your approval.",
    schedule: "08:00 · 12:00 · 16:00 weekdays",
    href: "/dashboard/team/cmo",
    icon: Megaphone,
    accent: "text-rose-600 bg-rose-500/10 border-rose-500/20",
    statusKey: "cmo",
    windowHours: 9,
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

  useEffect(() => {
    fetch("/api/intelligence/feed")
      .then((r) => r.json())
      .then((d) => setStatus(d.pipelineStatus ?? {}))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Automated reporting</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Background jobs run on your profile — outputs land in the feed and content queue.
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

          return (
            <Link
              key={p.id}
              href={p.href}
              className={cn(
                "group rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40",
                "border-border",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                    p.accent,
                  )}
                >
                  <p.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-foreground group-hover:text-primary truncate">
                      {p.title}
                    </p>
                    <Circle className={cn("h-2 w-2 fill-current shrink-0", dotColor)} />
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-snug mt-1 line-clamp-2">
                    {p.subtitle}
                  </p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <p className="text-[11px] text-muted-foreground/80">{p.schedule}</p>
                    <p className="text-[11px] text-muted-foreground/60 shrink-0">{lastRunLabel}</p>
                  </div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

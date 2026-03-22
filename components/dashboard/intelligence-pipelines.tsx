"use client"

import Link from "next/link"
import {
  Briefcase,
  FlaskConical,
  Megaphone,
  Cpu,
  Radio,
  Clock,
  ArrowUpRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Pipeline = {
  id: string
  title: string
  subtitle: string
  schedule: string
  href: string
  icon: typeof Briefcase
  accent: string
}

const PIPELINES: Pipeline[] = [
  {
    id: "cbs",
    title: "Daily brief",
    subtitle: "Scored news, research, regulation — tuned to your company context.",
    schedule: "Cron · ~05:00 (fan-out per user)",
    href: "/dashboard/team/cbs",
    icon: Briefcase,
    accent: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "cro",
    title: "Lead & job scan",
    subtitle: "HN hiring + Remotive; ICP fit scoring; qualified leads surfaced.",
    schedule: "Cron · every 6h",
    href: "/dashboard/team/cro",
    icon: FlaskConical,
    accent: "text-sky-600 bg-sky-500/10 border-sky-500/20",
  },
  {
    id: "cto",
    title: "Tech radar",
    subtitle: "CTO lane: arXiv + HN → trends & technical post suggestions (Inngest).",
    schedule: "Cron · ~06:00",
    href: "/dashboard/team",
    icon: Cpu,
    accent: "text-violet-600 bg-violet-500/10 border-violet-500/20",
  },
  {
    id: "cmo",
    title: "Content queue",
    subtitle: "CMO lane: LinkedIn drafts, comments, outreach — pending your approval.",
    schedule: "Scheduled + on-demand",
    href: "/dashboard/team/cmo",
    icon: Megaphone,
    accent: "text-rose-600 bg-rose-500/10 border-rose-500/20",
  },
]

export function IntelligencePipelines() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Automated reporting</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Background jobs run on your profile — outputs land in the app DB, WhatsApp (if configured), and your feed.
          </p>
        </div>
        <Link
          href="/dashboard/team"
          className="text-[12px] text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
        >
          Org chart
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PIPELINES.map((p) => (
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
                  <Radio className="h-3 w-3 text-muted-foreground opacity-60" />
                </div>
                <p className="text-[12px] text-muted-foreground leading-snug mt-1 line-clamp-2">
                  {p.subtitle}
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-2 flex items-center gap-1.5">
                  <Clock className="h-3 w-3 shrink-0" />
                  {p.schedule}
                </p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

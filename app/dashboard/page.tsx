"use client"

import { motion } from "framer-motion"
import {
  Briefcase,
  FlaskConical,
  Cpu,
  Megaphone,
  ArrowUpRight,
  BookOpen,
} from "lucide-react"
import Link from "next/link"
import { FounderDailyFeed } from "@/components/dashboard/founder-daily-feed"
import { IntelligencePipelines } from "@/components/dashboard/intelligence-pipelines"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

export default function DashboardPage() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto"
    >
      <motion.div variants={item} className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Intelligence overview
        </p>
        <h1 className="text-2xl font-semibold text-foreground">What Juno is watching for you</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Your backend runs scheduled scrapers, scoring, and delivery — briefs, leads, and radar
          reports are generated from your{" "}
          <Link href="/dashboard/company" className="text-primary hover:underline">
            company profile
          </Link>{" "}
          and{" "}
          <Link href="/dashboard/knowledge" className="text-primary hover:underline">
            knowledge base
          </Link>
          . This is a reporting surface, not a generic content factory.
        </p>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Daily brief",
            value: "~05:00",
            icon: Briefcase,
            hint: "CBS · cron",
          },
          {
            label: "Job / lead scan",
            value: "6h",
            icon: FlaskConical,
            hint: "CRO · Inngest",
          },
          {
            label: "Tech radar",
            value: "~06:00",
            icon: Cpu,
            hint: "CTO · Inngest",
          },
          {
            label: "Content drafts",
            value: "Queue",
            icon: Megaphone,
            hint: "CMO · approval",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.hint}</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{stat.value}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        <div className="order-2 lg:order-1 flex-1 min-w-0 flex flex-col gap-8">
          <motion.div variants={item}>
            <IntelligencePipelines />
          </motion.div>

          <motion.div variants={item} className="rounded-lg border border-dashed border-border bg-muted/20 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">Creation &amp; analysis tools</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 max-w-xl">
                    Pitch decks, market analysers, and GTM generators are still available under{" "}
                    <strong className="text-foreground/90">Tools &amp; generators</strong> in the sidebar — use them
                    when you need an asset; the default experience is intelligence reporting.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/command"
                className="text-[13px] text-primary hover:text-primary/80 flex items-center gap-1 shrink-0 self-start sm:self-center"
              >
                Legacy task planner
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        </div>

        <aside className="order-1 lg:order-2 w-full lg:w-[380px] lg:shrink-0 lg:sticky lg:top-20 lg:self-start">
          <FounderDailyFeed />
        </aside>
      </div>
    </motion.div>
  )
}

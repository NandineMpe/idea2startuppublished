"use client"

import { motion } from "framer-motion"
import { BookOpen, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { FounderDailyFeed } from "@/components/dashboard/founder-daily-feed"
import { BehavioralUpdatesPanel } from "@/components/dashboard/behavioral-updates-panel"
import { IntelligencePipelines } from "@/components/dashboard/intelligence-pipelines"
import { ContentQueue } from "@/components/dashboard/content-queue"
import { SecurityAlertsSummary } from "@/components/dashboard/security-alerts-summary"

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
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Agents run against your saved{" "}
          <Link href="/dashboard/context" className="text-primary hover:underline">
            company context
          </Link>
          . Briefs, behavioral updates, and drafts show up here for you to review, approve, and ship on the
          schedule you set.
        </p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        {/* Main column */}
        <div className="order-2 lg:order-1 flex-1 min-w-0 flex flex-col gap-8">
          <motion.div variants={item}>
            <SecurityAlertsSummary />
          </motion.div>

          <motion.div variants={item}>
            <IntelligencePipelines />
          </motion.div>

          <motion.div variants={item}>
            <BehavioralUpdatesPanel />
          </motion.div>

          <motion.div variants={item}>
            <ContentQueue />
          </motion.div>

          <motion.div variants={item} className="rounded-lg border border-dashed border-border bg-muted/20 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">One-off runs</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 max-w-xl">
                    Pitch, market, and GTM workflows you trigger when you need them — under{" "}
                    <strong className="text-foreground/90">Tools &amp; workflows</strong> in the sidebar.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/tools"
                className="text-[13px] text-primary hover:text-primary/80 flex items-center gap-1 shrink-0 self-start sm:self-center"
              >
                Browse tools
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Signal feed sidebar */}
        <aside className="order-1 lg:order-2 w-full lg:w-[380px] lg:shrink-0 lg:sticky lg:top-20 lg:self-start">
          <FounderDailyFeed />
        </aside>
      </div>
    </motion.div>
  )
}

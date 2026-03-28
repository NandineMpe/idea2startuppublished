"use client"

import { motion } from "framer-motion"
import { Activity, ChevronLeft, DollarSign, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import type { RoleConfig } from "@/types/agent-roles"
import { AgentStatusDot } from "./agent-status-dot"

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

interface RolePageProps {
  config: RoleConfig
}

export function RolePage({ config }: RolePageProps) {
  const budgetTotal = config.budgetMonthlyCents / 100

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-6 p-6 lg:p-8 max-w-6xl mx-auto"
    >
      <motion.div variants={item}>
        <Link
          href="/dashboard/team"
          className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to My Team
        </Link>
      </motion.div>

      <motion.div variants={item} className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center`}>
            <Activity className={`h-6 w-6 ${config.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold text-foreground">{config.title}</h1>
              <AgentStatusDot status="active" size="md" showLabel />
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-[13px] text-muted-foreground">Reports to: You (CEO)</p>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                Background jobs (Inngest)
              </span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-[13px] h-8">
          <Link href="/dashboard/command">
            <Zap className="h-3.5 w-3.5" />
            Command Center
          </Link>
        </Button>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Monthly Budget</p>
              <p className="text-lg font-semibold text-foreground">${budgetTotal}</p>
              <Progress value={0} className="mt-2 h-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Tracked for planning; execution uses your AI tool routes</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Status</p>
              <p className="text-lg font-semibold text-foreground">Active</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Jobs orchestrated with Inngest</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center`}>
              <Zap className={`h-4 w-4 ${config.color}`} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Capabilities</p>
              <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{config.capabilities}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <h2 className="text-[15px] font-semibold text-foreground mb-3">Responsibilities</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {config.responsibilities.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="rounded-lg border border-border bg-card p-3 hover:bg-accent/40 transition-colors"
            >
              <p className="text-[13px] font-medium text-foreground">{r.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>
            </Link>
          ))}
        </div>
      </motion.div>

      <motion.div variants={item}>
        <h2 className="text-[15px] font-semibold text-foreground mb-3">Work queue</h2>
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-[13px] text-muted-foreground max-w-lg mx-auto">
            Scheduled automations and briefs run in the background. Deploy a strategic goal from the Command Center to run tools for this role, or open any responsibility above.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

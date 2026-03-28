"use client"

import { motion } from "framer-motion"
import {
  DollarSign,
  Activity,
  Users,
  Zap,
  ExternalLink,
  Briefcase,
  FlaskConical,
  Megaphone,
  Wallet,
  Cog,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { OrgChart } from "@/components/dashboard/org-chart"
import { AgentStatusDot } from "@/components/dashboard/agent-status-dot"
import { ROLE_CONFIGS, ROLE_ORDER } from "@/lib/agent-roles"
import Link from "next/link"

const roleIcons: Record<string, React.ElementType> = {
  cbs: Briefcase,
  cro: FlaskConical,
  cmo: Megaphone,
  cfo: Wallet,
  coo: Cog,
}

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

export default function TeamOverviewPage() {
  const totalBudget = ROLE_ORDER.reduce((sum, slug) => sum + ROLE_CONFIGS[slug].budgetMonthlyCents, 0) / 100

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-6 p-6 lg:p-8 max-w-6xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Your Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your executive team, budgets, and agent activity.</p>
        </div>
        <a href="http://localhost:3100" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5 text-[13px] h-8">
            <ExternalLink className="h-3.5 w-3.5" />
            Paperclip Dashboard
          </Button>
        </a>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Team Size", value: "5", icon: Users },
          { label: "Active Agents", value: "5", icon: Activity },
          { label: "Total Budget", value: `$${totalBudget}/mo`, icon: DollarSign },
          { label: "Spend This Month", value: "$0", icon: Zap },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</p>
                <p className="text-lg font-semibold text-foreground">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Org Chart */}
      <motion.div variants={item}>
        <h2 className="text-[15px] font-semibold text-foreground mb-3">Organization Chart</h2>
        <div className="rounded-lg border border-border bg-card p-6">
          <OrgChart />
        </div>
      </motion.div>

      {/* Budget Allocation */}
      <motion.div variants={item}>
        <h2 className="text-[15px] font-semibold text-foreground mb-3">Budget Allocation</h2>
        <div className="rounded-lg border border-border bg-card">
          <div className="divide-y divide-border">
            {ROLE_ORDER.map((slug) => {
              const config = ROLE_CONFIGS[slug]
              const Icon = roleIcons[slug] || Briefcase
              const budget = config.budgetMonthlyCents / 100

              return (
                <Link key={slug} href={`/dashboard/team/${slug}`} className="block">
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors group">
                    <div className={`w-8 h-8 rounded-md ${config.bgColor} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">
                          {config.title}
                        </span>
                        <span className="text-[12px] text-muted-foreground">
                          $0 / ${budget}
                        </span>
                      </div>
                      <Progress value={0} className="h-1" />
                    </div>
                    <AgentStatusDot status="active" size="sm" />
                  </div>
                </Link>
              )
            })}

            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[13px] font-semibold text-foreground">Total</span>
              <span className="text-[13px] font-semibold text-foreground">$0 / ${totalBudget}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

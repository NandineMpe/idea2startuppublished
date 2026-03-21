"use client"

import { motion } from "framer-motion"
import {
  ArrowUpRight,
  Briefcase,
  FlaskConical,
  Megaphone,
  Wallet,
  Cog,
  Users,
  Activity,
  TrendingUp,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { ROLE_CONFIGS, ROLE_ORDER } from "@/lib/paperclip"
import { AgentStatusDot } from "@/components/dashboard/agent-status-dot"
import { FounderDailyFeed } from "@/components/dashboard/founder-daily-feed"

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

export default function DashboardPage() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto"
    >
      {/* Header */}
      <motion.div variants={item} className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Command Center
        </h1>
        <p className="text-sm text-muted-foreground">
          Your executive team is standing by. Select a member to delegate work or review their capabilities.
        </p>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Agents", value: "5", icon: Users, trend: "All online" },
          { label: "Tasks Running", value: "0", icon: Activity, trend: "Ready" },
          { label: "Monthly Budget", value: "$190", icon: Wallet, trend: "5 agents" },
          { label: "Completion Rate", value: "—", icon: TrendingUp, trend: "No data yet" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <stat.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">{stat.trend}</span>
            </div>
            <p className="text-xl font-semibold text-foreground">{stat.value}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Main column + Today's Brief sidebar (see docs/command-center-daily-feed.md) */}
      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* Section Header */}
          <motion.div variants={item} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-foreground">Executive Team</h2>
              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {ROLE_ORDER.length} members
              </span>
            </div>
            <Link
              href="/dashboard/team"
              className="text-[13px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              View org chart
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </motion.div>

          {/* Executive Team Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {ROLE_ORDER.map((slug) => {
          const config = ROLE_CONFIGS[slug]
          const Icon = roleIcons[slug] || Briefcase

          return (
            <motion.div key={slug} variants={item}>
              <Link href={`/dashboard/team/${slug}`} className="block group">
                <div className="rounded-lg border border-border bg-card hover:bg-accent/50 transition-all duration-200 p-5 h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">
                          {config.shortTitle}
                        </p>
                        <p className="text-[12px] text-muted-foreground">{config.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AgentStatusDot status="active" size="sm" />
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </div>

                  <p className="text-[12px] text-muted-foreground leading-relaxed mb-4 line-clamp-2">
                    {config.capabilities}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-[11px] text-muted-foreground">
                      {config.responsibilities.length} tools
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      ${config.budgetMonthlyCents / 100}/mo
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          )
        })}

        {/* Quick Actions Card */}
        <motion.div variants={item}>
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-5 h-full flex flex-col items-center justify-center text-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-foreground">Quick Start</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Click any executive to start delegating tasks to your AI team.
              </p>
            </div>
            <Link
              href="/dashboard/team"
              className="text-[12px] text-primary hover:text-primary/80 font-medium transition-colors"
            >
              View full team
            </Link>
          </div>
        </motion.div>
          </div>
        </div>

        <motion.aside
          variants={item}
          className="w-full lg:w-[min(100%,380px)] lg:shrink-0 lg:sticky lg:top-20 lg:self-start"
        >
          <FounderDailyFeed />
        </motion.aside>
      </div>
    </motion.div>
  )
}

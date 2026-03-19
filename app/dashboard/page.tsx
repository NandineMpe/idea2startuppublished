"use client"

import { motion } from "framer-motion"
import {
  Zap,
  ArrowUpRight,
  Briefcase,
  FlaskConical,
  Megaphone,
  Wallet,
  Cog,
  Crown,
  UserCircle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ROLE_CONFIGS, ROLE_ORDER } from "@/lib/paperclip"
import { AgentStatusDot } from "@/components/dashboard/agent-status-dot"

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
    transition: { staggerChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export default function DashboardPage() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-8 p-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={item} className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary font-medium tracking-wider uppercase text-xs">
          <Crown className="h-3 w-3 fill-primary" />
          Founder Command Center
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">
          Welcome, <span className="text-primary italic">CEO</span>
        </h1>
        <p className="text-white/60 max-w-xl">
          Your executive team is standing by. Select a team member to delegate work or review their responsibilities.
        </p>
      </motion.div>

      {/* Mini Org Chart */}
      <motion.div variants={item} className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5">
          <Crown className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">You (CEO)</span>
        </div>
        <Zap className="h-3 w-3 text-white/20" />
        {ROLE_ORDER.map((slug) => {
          const config = ROLE_CONFIGS[slug]
          const Icon = roleIcons[slug] || UserCircle
          return (
            <Link
              key={slug}
              href={`/dashboard/team/${slug}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 hover:border-primary/30 transition-colors bg-white/5 hover:bg-primary/5"
            >
              <Icon className={`h-3 w-3 ${config.color}`} />
              <span className="text-xs text-white/70">{config.shortTitle}</span>
              <AgentStatusDot status="active" size="sm" />
            </Link>
          )
        })}
      </motion.div>

      {/* Executive Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ROLE_ORDER.map((slug, i) => {
          const config = ROLE_CONFIGS[slug]
          const Icon = roleIcons[slug] || UserCircle

          return (
            <motion.div key={slug} variants={item}>
              <Link href={`/dashboard/team/${slug}`}>
                <Card className="glass-card border-white/5 hover:border-primary/20 transition-all duration-300 h-full group hover:bg-white/5 cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-12 h-12 rounded-lg ${config.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`h-6 w-6 ${config.color}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <AgentStatusDot status="active" size="md" showLabel />
                        <ArrowUpRight className="h-4 w-4 text-white/20 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                    <CardTitle className="text-xl text-white group-hover:text-primary transition-colors">
                      {config.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-white/50 mb-4">
                      {config.capabilities}
                    </CardDescription>
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <span className="text-xs text-white/30">
                        {config.responsibilities.length} responsibilities
                      </span>
                      <span className="text-xs text-white/30">
                        ${config.budgetMonthlyCents / 100}/mo budget
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          )
        })}

        {/* Team Overview Card */}
        <motion.div variants={item}>
          <Link href="/dashboard/team">
            <Card className="glass-card border-primary/10 hover:border-primary/30 transition-all duration-300 h-full group hover:bg-primary/5 cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Crown className="h-6 w-6 text-primary" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-white/20 group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="text-xl text-white group-hover:text-primary transition-colors">
                  Team Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-white/50 mb-4">
                  View the full org chart, cost dashboard, and manage all agents from one place.
                </CardDescription>
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-xs text-white/30">5 executives</span>
                  <span className="text-xs text-primary font-medium">View all</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>
    </motion.div>
  )
}

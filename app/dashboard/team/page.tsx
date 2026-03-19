"use client"

import { motion } from "framer-motion"
import {
  Crown,
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
  UserCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { OrgChart } from "@/components/dashboard/org-chart"
import { AgentStatusDot } from "@/components/dashboard/agent-status-dot"
import { ROLE_CONFIGS, ROLE_ORDER } from "@/lib/paperclip"
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
    transition: { staggerChildren: 0.08 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export default function TeamOverviewPage() {
  const totalBudget = ROLE_ORDER.reduce((sum, slug) => sum + ROLE_CONFIGS[slug].budgetMonthlyCents, 0) / 100
  const totalUsed = 0

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-8 p-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary font-medium tracking-wider uppercase text-xs mb-2">
            <Crown className="h-3 w-3 fill-primary" />
            Organization
          </div>
          <h1 className="text-3xl font-bold text-white">Your Team</h1>
          <p className="text-white/50 mt-1">Manage your executive team, budgets, and agent activity.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="http://localhost:3100"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-white/70 hover:text-primary hover:border-primary/30 gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Paperclip Dashboard
            </Button>
          </a>
        </div>
      </motion.div>

      {/* Summary Stats */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card border-white/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider">Team Size</p>
                <p className="text-2xl font-bold text-white">5</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider">Active Agents</p>
                <p className="text-2xl font-bold text-white">5</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider">Total Budget</p>
                <p className="text-2xl font-bold text-white">${totalBudget}/mo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider">Spend This Month</p>
                <p className="text-2xl font-bold text-white">${totalUsed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Org Chart */}
      <motion.div variants={item}>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          Organization Chart
        </h2>
        <Card className="glass-card border-white/5 p-6">
          <OrgChart />
        </Card>
      </motion.div>

      {/* Cost Dashboard */}
      <motion.div variants={item}>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Budget Allocation
        </h2>
        <Card className="glass-card border-white/5">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {ROLE_ORDER.map((slug) => {
                const config = ROLE_CONFIGS[slug]
                const Icon = roleIcons[slug] || UserCircle
                const budget = config.budgetMonthlyCents / 100
                const used = 0
                const percent = 0

                return (
                  <Link key={slug} href={`/dashboard/team/${slug}`} className="block">
                    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors group">
                      <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white group-hover:text-primary transition-colors">
                            {config.title}
                          </span>
                          <span className="text-xs text-white/40">
                            ${used} / ${budget}
                          </span>
                        </div>
                        <Progress value={percent} className="h-1.5" />
                      </div>
                      <AgentStatusDot status="active" size="sm" />
                    </div>
                  </Link>
                )
              })}

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-sm font-semibold text-white">${totalUsed} / ${totalBudget}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Play,
  Pause,
  Zap,
  ArrowUpRight,
  DollarSign,
  Activity,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronLeft,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import type { RoleConfig, AgentStatus } from "@/types/paperclip"
import { AgentStatusDot } from "./agent-status-dot"

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

interface RolePageProps {
  config: RoleConfig
}

export function RolePage({ config }: RolePageProps) {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("active")
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const budgetUsedPercent = 0
  const budgetTotal = config.budgetMonthlyCents / 100

  const handleAction = async (action: "pause" | "resume" | "heartbeat") => {
    setIsLoading(action)
    setLastAction(null)
    try {
      const res = await fetch(`/api/paperclip/agents/${config.agentName}/${action}`, { method: "POST" })
      if (res.ok || res.status === 503) {
        if (action === "pause") setAgentStatus("paused")
        if (action === "resume") setAgentStatus("active")
        const labels = { pause: "paused", resume: "resumed", heartbeat: "Heartbeat sent to" }
        setLastAction({
          message: action === "heartbeat" ? `Heartbeat sent to ${config.shortTitle}` : `${config.shortTitle} ${labels[action]}`,
          type: "success",
        })
      } else {
        throw new Error("Failed")
      }
    } catch {
      setLastAction({ message: "Could not reach Paperclip service", type: "error" })
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-6 p-6 lg:p-8 max-w-6xl mx-auto"
    >
      {/* Breadcrumb */}
      <motion.div variants={item}>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Command Center
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div variants={item} className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center`}>
            <Activity className={`h-6 w-6 ${config.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold text-foreground">{config.title}</h1>
              <AgentStatusDot status={agentStatus} size="md" showLabel />
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">Reports to: You (CEO / Board)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {agentStatus === "active" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("pause")}
              disabled={isLoading !== null}
              className="gap-1.5 text-[13px] h-8"
            >
              {isLoading === "pause" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("resume")}
              disabled={isLoading !== null}
              className="gap-1.5 text-[13px] h-8"
            >
              {isLoading === "resume" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Resume
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("heartbeat")}
            disabled={isLoading !== null}
            className="gap-1.5 text-[13px] h-8"
          >
            {isLoading === "heartbeat" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Heartbeat
          </Button>
        </div>
      </motion.div>

      {/* Action feedback */}
      {lastAction && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-[13px] ${
            lastAction.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
              : "bg-amber-500/10 border border-amber-500/20 text-amber-500"
          }`}
        >
          {lastAction.type === "success" ? (
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          )}
          {lastAction.message}
        </motion.div>
      )}

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Monthly Budget</p>
              <p className="text-lg font-semibold text-foreground">${budgetTotal}</p>
              <Progress value={budgetUsedPercent} className="mt-2 h-1" />
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
              <p className="text-lg font-semibold text-foreground capitalize">{agentStatus}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {agentStatus === "active" ? "Ready to receive work" : "Agent is paused"}
              </p>
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

      {/* Responsibilities */}
      <motion.div variants={item}>
        <h2 className="text-[15px] font-semibold text-foreground mb-3">Tools & Responsibilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {config.responsibilities.map((resp, i) => (
            <Link key={i} href={resp.href}>
              <div className="rounded-lg border border-border bg-card hover:bg-accent/50 transition-all duration-200 p-4 h-full group cursor-pointer">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">
                    {resp.title}
                  </p>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-all shrink-0 ml-2" />
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  {resp.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Activity */}
      <motion.div variants={item}>
        <h2 className="text-[15px] font-semibold text-foreground mb-3">Recent Activity</h2>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
              <Play className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[13px] text-muted-foreground">No activity yet</p>
            <p className="text-[12px] text-muted-foreground/60 mt-1">
              Send a heartbeat to trigger this agent's work cycle
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("heartbeat")}
              disabled={isLoading !== null}
              className="mt-4 gap-1.5 text-[13px] h-8"
            >
              <Zap className="h-3.5 w-3.5" />
              Send Heartbeat
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

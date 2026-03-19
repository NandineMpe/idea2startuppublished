"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Play,
  Pause,
  Zap,
  ArrowUpRight,
  UserCircle,
  Briefcase,
  DollarSign,
  Activity,
  CheckCircle,
  AlertTriangle,
  Loader2,
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
    transition: { staggerChildren: 0.08 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
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

  const handlePause = async () => {
    setIsLoading("pause")
    setLastAction(null)
    try {
      const res = await fetch(`/api/paperclip/agents/${config.agentName}/pause`, { method: "POST" })
      if (res.ok) {
        setAgentStatus("paused")
        setLastAction({ message: `${config.shortTitle} paused successfully`, type: "success" })
      } else if (res.status === 503) {
        setAgentStatus("paused")
        setLastAction({ message: `${config.shortTitle} marked as paused (Paperclip offline)`, type: "success" })
      } else {
        throw new Error("Failed to pause")
      }
    } catch {
      setLastAction({ message: "Could not reach Paperclip service", type: "error" })
    } finally {
      setIsLoading(null)
    }
  }

  const handleResume = async () => {
    setIsLoading("resume")
    setLastAction(null)
    try {
      const res = await fetch(`/api/paperclip/agents/${config.agentName}/resume`, { method: "POST" })
      if (res.ok) {
        setAgentStatus("active")
        setLastAction({ message: `${config.shortTitle} resumed successfully`, type: "success" })
      } else if (res.status === 503) {
        setAgentStatus("active")
        setLastAction({ message: `${config.shortTitle} marked as active (Paperclip offline)`, type: "success" })
      } else {
        throw new Error("Failed to resume")
      }
    } catch {
      setLastAction({ message: "Could not reach Paperclip service", type: "error" })
    } finally {
      setIsLoading(null)
    }
  }

  const handleHeartbeat = async () => {
    setIsLoading("heartbeat")
    setLastAction(null)
    try {
      const res = await fetch(`/api/paperclip/agents/${config.agentName}/heartbeat`, { method: "POST" })
      if (res.ok) {
        setLastAction({ message: `Heartbeat sent to ${config.shortTitle}`, type: "success" })
      } else if (res.status === 503) {
        setLastAction({ message: `Heartbeat queued (Paperclip offline - start it with npm run dev:all)`, type: "error" })
      } else {
        throw new Error("Heartbeat failed")
      }
    } catch {
      setLastAction({ message: "Could not reach Paperclip service - run npm run dev:all to start", type: "error" })
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-8 p-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-xl ${config.bgColor} flex items-center justify-center`}>
            <UserCircle className={`h-8 w-8 ${config.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-white">{config.title}</h1>
              <AgentStatusDot status={agentStatus} size="md" showLabel />
            </div>
            <p className="text-white/50 mt-1">Reports to: You (CEO / Board)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {agentStatus === "active" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              disabled={isLoading !== null}
              className="border-white/10 text-white/70 hover:text-yellow-400 hover:border-yellow-400/30 gap-1.5"
            >
              {isLoading === "pause" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResume}
              disabled={isLoading !== null}
              className="border-white/10 text-white/70 hover:text-emerald-400 hover:border-emerald-400/30 gap-1.5"
            >
              {isLoading === "resume" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Resume
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleHeartbeat}
            disabled={isLoading !== null}
            className="border-white/10 text-white/70 hover:text-primary hover:border-primary/30 gap-1.5"
          >
            {isLoading === "heartbeat" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Heartbeat
          </Button>
        </div>
      </motion.div>

      {/* Action feedback */}
      {lastAction && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
            lastAction.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
          }`}
        >
          {lastAction.type === "success" ? (
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          )}
          {lastAction.message}
        </motion.div>
      )}

      {/* Stats Row */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card border-white/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/50 uppercase tracking-wider">Monthly Budget</p>
                <p className="text-xl font-bold text-white">${budgetTotal}</p>
                <Progress value={budgetUsedPercent} className="mt-2 h-1.5" />
                <p className="text-xs text-white/40 mt-1">${(budgetUsedPercent * budgetTotal / 100).toFixed(2)} used</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider">Status</p>
                <p className="text-xl font-bold text-white capitalize">{agentStatus}</p>
                <p className="text-xs text-white/40 mt-1">
                  {agentStatus === "active" ? "Ready to receive work" : "Agent is paused"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider">Capabilities</p>
                <p className="text-sm text-white/70 mt-1 leading-relaxed">{config.capabilities}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Responsibilities */}
      <motion.div variants={item}>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Responsibilities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {config.responsibilities.map((resp, i) => (
            <Link key={i} href={resp.href}>
              <Card className="glass-card border-white/5 hover:border-primary/20 transition-all duration-300 h-full group cursor-pointer hover:bg-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-white group-hover:text-primary transition-colors flex items-center justify-between">
                    {resp.title}
                    <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-white/50 text-sm">
                    {resp.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={item}>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Recent Activity
        </h2>
        <Card className="glass-card border-white/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Play className="h-5 w-5 text-white/30" />
              </div>
              <p className="text-white/40 text-sm">No activity yet</p>
              <p className="text-white/25 text-xs mt-1">
                Click &quot;Heartbeat&quot; above to trigger this agent&apos;s work cycle
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleHeartbeat}
                disabled={isLoading !== null}
                className="mt-4 border-primary/20 text-primary hover:bg-primary/10 gap-1.5"
              >
                <Zap className="h-3.5 w-3.5" />
                Send Heartbeat
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

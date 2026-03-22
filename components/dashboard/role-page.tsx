"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import {
  Play,
  Pause,
  Zap,
  DollarSign,
  Activity,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  Plus,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import type { RoleConfig, AgentStatus, Agent } from "@/types/paperclip"
import { AgentStatusDot } from "./agent-status-dot"
import { resolveAgentByName } from "@/lib/paperclip"

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
  const [agent, setAgent] = useState<Agent | null>(null)
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("active")
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [paperclipOnline, setPaperclipOnline] = useState<boolean | null>(null)
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [issueTitle, setIssueTitle] = useState("")
  const [issueDescription, setIssueDescription] = useState("")
  const [issues, setIssues] = useState<import("@/types/paperclip").Issue[]>([])

  const fetchAgent = useCallback(async () => {
    try {
      const resolved = await resolveAgentByName(config.agentName)
      if (resolved) {
        setAgent(resolved)
        setAgentStatus(resolved.status)
        setPaperclipOnline(true)
        // Fetch issues for this agent
        try {
          const issuesRes = await fetch(`/api/paperclip/companies/${resolved.companyId}/issues`)
          if (issuesRes.ok) {
            const all: import("@/types/paperclip").Issue[] = await issuesRes.json()
            setIssues(all.filter((i) => i.assignedAgentId === resolved.id))
          }
        } catch {
          // non-fatal
        }
      } else {
        setPaperclipOnline(false)
      }
    } catch {
      setPaperclipOnline(false)
    }
  }, [config.agentName])

  useEffect(() => {
    fetchAgent()
  }, [fetchAgent])

  const budgetUsedPercent = agent ? Math.min(100, (agent.budgetUsedCents / agent.budgetMonthlyCents) * 100) : 0
  const budgetTotal = agent ? agent.budgetMonthlyCents / 100 : config.budgetMonthlyCents / 100
  const budgetUsed = agent ? agent.budgetUsedCents / 100 : 0

  const handleAction = async (action: "pause" | "resume" | "heartbeat") => {
    const id = agent?.id
    if (!id) {
      setLastAction({ message: "Agent not found in Paperclip. Run npm run seed:agents first.", type: "error" })
      return
    }

    setIsLoading(action)
    setLastAction(null)
    try {
      const res = await fetch(`/api/paperclip/agents/${id}/${action}`, { method: "POST" })
      if (res.ok) {
        if (action === "pause") setAgentStatus("paused")
        if (action === "resume") setAgentStatus("active")
        const labels = { pause: "paused", resume: "resumed", heartbeat: "Heartbeat sent to" }
        setLastAction({
          message: action === "heartbeat" ? `Heartbeat sent to ${config.shortTitle}` : `${config.shortTitle} ${labels[action]}`,
          type: "success",
        })
        await fetchAgent()
      } else if (res.status === 503) {
        setLastAction({ message: "Paperclip sidecar is offline. Start it with: npm run dev:all", type: "error" })
      } else {
        throw new Error("Failed")
      }
    } catch {
      setLastAction({ message: "Could not reach Paperclip service", type: "error" })
    } finally {
      setIsLoading(null)
    }
  }

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agent || !issueTitle.trim()) return

    setIsLoading("issue")
    try {
      const res = await fetch(`/api/paperclip/companies/${agent.companyId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: issueTitle,
          description: issueDescription,
          assignedAgentId: agent.id,
        }),
      })
      if (res.ok) {
        setLastAction({ message: `Task "${issueTitle}" assigned to ${config.shortTitle}`, type: "success" })
        setIssueTitle("")
        setIssueDescription("")
        setShowIssueForm(false)
      } else {
        throw new Error("Failed to create issue")
      }
    } catch {
      setLastAction({ message: "Could not create task. Is Paperclip running?", type: "error" })
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
      <motion.div variants={item}>
        <Link href="/dashboard/team" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to My Team
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
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-[13px] text-muted-foreground">Reports to: You (CEO)</p>
              {paperclipOnline !== null && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded ${paperclipOnline ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                  {paperclipOnline ? "Paperclip connected" : "Paperclip offline"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {agentStatus === "active" ? (
            <Button variant="outline" size="sm" onClick={() => handleAction("pause")} disabled={isLoading !== null} className="gap-1.5 text-[13px] h-8">
              {isLoading === "pause" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
              Pause
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => handleAction("resume")} disabled={isLoading !== null} className="gap-1.5 text-[13px] h-8">
              {isLoading === "resume" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Resume
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => handleAction("heartbeat")} disabled={isLoading !== null} className="gap-1.5 text-[13px] h-8">
            {isLoading === "heartbeat" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Heartbeat
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowIssueForm(!showIssueForm)} className="gap-1.5 text-[13px] h-8">
            <Plus className="h-3.5 w-3.5" />
            Assign Task
          </Button>
        </div>
      </motion.div>

      {/* Feedback */}
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
          {lastAction.type === "success" ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          {lastAction.message}
        </motion.div>
      )}

      {/* Assign Task Form */}
      {showIssueForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
          <form onSubmit={handleCreateIssue} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="text-[13px] font-medium text-foreground">Assign a task to {config.shortTitle}</p>
            <Input
              placeholder="Task title"
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
              className="text-[13px] h-9 bg-background"
              required
            />
            <Textarea
              placeholder="Task description (optional)"
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              className="text-[13px] min-h-[60px] bg-background"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isLoading === "issue" || !issueTitle.trim()} className="gap-1.5 text-[13px] h-8">
                {isLoading === "issue" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Create & Assign
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowIssueForm(false)} className="text-[13px] h-8">
                Cancel
              </Button>
            </div>
          </form>
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
              <p className="text-[11px] text-muted-foreground mt-1">${budgetUsed.toFixed(2)} used</p>
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
                {agent ? `ID: ${agent.id.slice(0, 8)}...` : "Not connected to Paperclip"}
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

      {/* Activity / Issues */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-foreground">Work Queue</h2>
          {issues.length > 0 && (
            <span className="text-[11px] text-muted-foreground">{issues.length} issue{issues.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {issues.length > 0 ? (
            <div className="divide-y divide-border">
              {issues.map((issue) => (
                <div key={issue.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                    issue.status === "closed" ? "bg-emerald-500" :
                    issue.status === "in_progress" ? "bg-primary animate-pulse" :
                    "bg-muted-foreground/40"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground truncate">{issue.title}</p>
                    {issue.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{issue.description}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/60 mt-1 capitalize">
                      {issue.status.replace("_", " ")} · {new Date(issue.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded capitalize ${
                    issue.status === "closed" ? "bg-emerald-500/10 text-emerald-500" :
                    issue.status === "in_progress" ? "bg-primary/10 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {issue.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <Play className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">No tasks assigned yet</p>
              <p className="text-[12px] text-muted-foreground/60 mt-1">
                {paperclipOnline
                  ? "Go to Command Center and deploy a goal — this agent will pick up tasks automatically"
                  : "Start Paperclip with: npm run dev:all"}
              </p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => setShowIssueForm(true)} className="gap-1.5 text-[13px] h-8">
                  <Plus className="h-3.5 w-3.5" />
                  Assign Task
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAction("heartbeat")} disabled={isLoading !== null} className="gap-1.5 text-[13px] h-8">
                  <Zap className="h-3.5 w-3.5" />
                  Send Heartbeat
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

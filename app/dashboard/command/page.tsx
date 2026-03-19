"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Zap,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Target,
  Users,
  ArrowRight,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlannedTask {
  agent: string
  agentLabel: string
  tool: string
  toolLabel: string
  title: string
  rationale: string
  inputs: Record<string, string>
}

interface Plan {
  goal: string
  breakdown: string
  tasks: PlannedTask[]
  paperclipGoalId?: string
}

type TaskState = "pending" | "running" | "done" | "error"

interface TaskResult {
  task: PlannedTask
  state: TaskState
  output?: string
  error?: string
}

// ─── Agent colours ────────────────────────────────────────────────────────────

const AGENT_STYLE: Record<string, { color: string; bg: string; ring: string }> = {
  cbs: { color: "text-amber-400",   bg: "bg-amber-400/10",   ring: "ring-amber-400/30" },
  cro: { color: "text-blue-400",    bg: "bg-blue-400/10",    ring: "ring-blue-400/30" },
  cmo: { color: "text-rose-400",    bg: "bg-rose-400/10",    ring: "ring-rose-400/30" },
  cfo: { color: "text-emerald-400", bg: "bg-emerald-400/10", ring: "ring-emerald-400/30" },
  coo: { color: "text-violet-400",  bg: "bg-violet-400/10",  ring: "ring-violet-400/30" },
}

// ─── Preset goals ─────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Prepare for fundraising", icon: "💰", goal: "Prepare us to raise a seed round of $1–2M. Assess our readiness, recommend a funding strategy, and identify which investors to target." },
  { label: "Launch in a new market", icon: "🌍", goal: "We want to expand internationally. Analyse which markets to enter first, create an entry strategy, and identify relevant events and opportunities." },
  { label: "Build our go-to-market plan", icon: "🚀", goal: "Create a complete go-to-market strategy. Analyse competitors, identify the best opportunities, and plan our pitch for customers and partners." },
  { label: "Scale the team", icon: "👥", goal: "Help us scale from 2 founders to a full team. Define the roles we need, create job descriptions, and plan the hiring process and compensation." },
]

// ─── Result card ──────────────────────────────────────────────────────────────

function TaskResultCard({ result }: { result: TaskResult }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const style = AGENT_STYLE[result.task.agent] ?? AGENT_STYLE.cbs

  const handleCopy = () => {
    if (result.output) {
      navigator.clipboard.writeText(result.output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        result.state === "running" && "ring-1 ring-primary/30",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold", style.bg, style.color)}>
            {result.task.agent.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{result.task.title}</p>
            <p className="text-[11px] text-muted-foreground">{result.task.agentLabel} · {result.task.toolLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {result.state === "running" && (
            <span className="flex items-center gap-1.5 text-[11px] text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              Working…
            </span>
          )}
          {result.state === "done" && (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-500">
              <CheckCircle className="h-3 w-3" />
              Done
            </span>
          )}
          {result.state === "error" && (
            <span className="flex items-center gap-1.5 text-[11px] text-red-400">
              <AlertTriangle className="h-3 w-3" />
              Failed
            </span>
          )}
          {result.state === "done" && result.output && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleCopy}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setExpanded((x) => !x)}>
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Rationale */}
      <div className="px-4 pb-3">
        <p className="text-[12px] text-muted-foreground italic">{result.task.rationale}</p>
      </div>

      {/* Expanded output */}
      <AnimatePresence>
        {expanded && result.output && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-4 prose-content text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-[500px] overflow-y-auto">
              {result.output}
            </div>
          </motion.div>
        )}
        {expanded && result.error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-4 text-[13px] text-red-400">{result.error}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CommandPage() {
  const [goal, setGoal] = useState("")
  const [context, setContext] = useState("")
  const [phase, setPhase] = useState<"idle" | "planning" | "executing" | "done">("idle")
  const [plan, setPlan] = useState<Plan | null>(null)
  const [results, setResults] = useState<TaskResult[]>([])
  const [planError, setPlanError] = useState<string | null>(null)

  const completedCount = results.filter((r) => r.state === "done").length
  const totalCount = results.length

  const handleDeploy = async () => {
    if (!goal.trim()) return
    setPhase("planning")
    setPlan(null)
    setResults([])
    setPlanError(null)

    // ── Plan the delegation ────────────────────────────────────────────────
    let fetchedPlan: Plan
    try {
      const res = await fetch("/api/delegate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), context: context.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Planning failed")
      }
      fetchedPlan = await res.json()
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Failed to plan")
      setPhase("idle")
      return
    }

    setPlan(fetchedPlan)
    setPhase("executing")

    // Initialise all results as "pending"
    const initialResults: TaskResult[] = fetchedPlan.tasks.map((t) => ({
      task: t,
      state: "pending",
    }))
    setResults(initialResults)

    // ── Execute each task sequentially ────────────────────────────────────
    for (let i = 0; i < fetchedPlan.tasks.length; i++) {
      const task = fetchedPlan.tasks[i]

      // Mark as running
      setResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, state: "running" } : r)),
      )

      try {
        const res = await fetch("/api/ai-tool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: task.tool, inputs: task.inputs }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Tool failed")

        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, state: "done", output: data.result } : r,
          ),
        )
      } catch (err) {
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, state: "error", error: err instanceof Error ? err.message : "Failed" }
              : r,
          ),
        )
      }
    }

    setPhase("done")
  }

  const handleReset = () => {
    setPhase("idle")
    setPlan(null)
    setResults([])
    setPlanError(null)
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Strategic Command Center</h1>
            <p className="text-[13px] text-muted-foreground">Set a goal. Your executive team executes it.</p>
          </div>
        </div>
      </motion.div>

      {/* How it works banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl border border-border bg-card p-4"
      >
        <div className="flex items-start gap-3">
          <Globe className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-foreground mb-1">How this works</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              You set a strategic goal. The AI chief of staff breaks it into specific tasks and routes each one to the right executive — CBS, CRO, CMO, CFO, or COO. Each agent brings their own expertise and tools. Paperclip records the goal in your org&apos;s work log. You get a full set of deliverables in one run.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Input section */}
      {phase === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-5"
        >
          {/* Presets */}
          <div>
            <p className="text-[12px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Quick start</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setGoal(p.goal)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-accent/50 text-left transition-colors group"
                >
                  <span className="text-base shrink-0">{p.icon}</span>
                  <span className="text-[12px] text-muted-foreground group-hover:text-foreground transition-colors">{p.label}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-all ml-auto" />
                </button>
              ))}
            </div>
          </div>

          {/* Goal input */}
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-foreground">
              Strategic goal <span className="text-red-400">*</span>
            </label>
            <Textarea
              placeholder="e.g. We want to raise a $2M seed round in the next 6 months. Help us prepare."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="min-h-[100px] text-[13px] bg-background resize-none"
            />
          </div>

          {/* Context input */}
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-foreground">
              Startup context <span className="text-[12px] text-muted-foreground font-normal">(helps agents give more relevant output)</span>
            </label>
            <Textarea
              placeholder="e.g. B2B SaaS for HR teams. We have 50 customers, $30K MRR, 2 founders, based in London."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="min-h-[80px] text-[13px] bg-background resize-none"
            />
          </div>

          {planError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {planError}
            </div>
          )}

          <Button
            onClick={handleDeploy}
            disabled={!goal.trim()}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Users className="h-4 w-4" />
            Deploy Executive Team
          </Button>
        </motion.div>
      )}

      {/* Planning state */}
      {phase === "planning" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 gap-4"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-medium text-foreground">Briefing the team…</p>
            <p className="text-[12px] text-muted-foreground mt-1">Decomposing goal and routing to the right agents</p>
          </div>
        </motion.div>
      )}

      {/* Executing / Done */}
      {(phase === "executing" || phase === "done") && plan && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Plan summary */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Your Goal</p>
                <p className="text-[13px] text-foreground font-medium">{plan.goal}</p>
              </div>
              {plan.paperclipGoalId && (
                <span className="shrink-0 text-[11px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Logged in Paperclip
                </span>
              )}
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Team Briefing</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">{plan.breakdown}</p>
            </div>
            {phase === "executing" && (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {completedCount}/{totalCount} tasks
                </span>
              </div>
            )}
          </div>

          {/* Task results */}
          <div className="space-y-3">
            {results.map((result, i) => (
              <TaskResultCard key={i} result={result} />
            ))}
          </div>

          {/* Done state actions */}
          {phase === "done" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 pt-2"
            >
              <div className="flex items-center gap-2 text-[13px] text-emerald-500">
                <CheckCircle className="h-4 w-4" />
                <span>{completedCount} of {totalCount} tasks completed</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset} className="ml-auto text-[13px] h-8">
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                New goal
              </Button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  )
}

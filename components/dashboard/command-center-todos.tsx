"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2,
  BookOpen,
  Radio,
  UsersRound,
  MessageCircle,
  Sparkles,
  Wrench,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "idea2startup-command-todos-v1"
const CHECKLIST_COLLAPSED_KEY = "idea2startup-command-checklist-collapsed-v1"
const STORAGE_VERSION = 1 as const

type TemplateTodo = {
  id: string
  title: string
  hint: string
  href: string
  icon: typeof Building2
  /** Scroll to this anchor on command page instead of navigating */
  anchor?: string
}

const TEMPLATE_TODOS: TemplateTodo[] = [
  {
    id: "ctx-company",
    title: "Anchor your company context",
    hint: "Company name, problem, and market are included in agent prompts.",
    href: "/dashboard/company",
    icon: Building2,
  },
  {
    id: "ctx-knowledge",
    title: "Add knowledge Juno can reuse",
    hint: "Upload notes or documents for retrieval in chat and tools.",
    href: "/dashboard/knowledge",
    icon: BookOpen,
  },
  {
    id: "intel-feed",
    title: "Scan the Intelligence Feed",
    hint: "Briefs, leads, content queue, and radar on the home feed.",
    href: "/dashboard",
    icon: Radio,
  },
  {
    id: "team-outputs",
    title: "Review My Team outputs",
    hint: "CBS, CRO, CMO, CTO: review outputs and approve where needed.",
    href: "/dashboard/team",
    icon: UsersRound,
  },
  {
    id: "signal-feed",
    title: "Use the Signal feed for alerts",
    hint: "Open the dashboard feed for briefs, leads, and drafts.",
    href: "/dashboard",
    icon: MessageCircle,
  },
  {
    id: "delegate-goal",
    title: "Run a strategic goal below",
    hint: "Delegation runs agents in sequence and returns deliverables.",
    href: "/dashboard/command",
    anchor: "strategic-command-input",
    icon: Sparkles,
  },
  {
    id: "tools-pitch",
    title: "Sharpen pitch & customer story",
    hint: "Workflows for investor pitch, value prop, and narrative consistency — you run and own the output.",
    href: "/dashboard/tools",
    icon: Wrench,
  },
]

type CustomTodo = { id: string; title: string; done: boolean }

type StoredShape = {
  v: typeof STORAGE_VERSION
  checked: Record<string, boolean>
  custom: CustomTodo[]
}

function loadStored(): StoredShape {
  if (typeof window === "undefined") {
    return { v: STORAGE_VERSION, checked: {}, custom: [] }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { v: STORAGE_VERSION, checked: {}, custom: [] }
    const p = JSON.parse(raw) as StoredShape
    if (p.v !== STORAGE_VERSION) return { v: STORAGE_VERSION, checked: {}, custom: [] }
    return {
      v: STORAGE_VERSION,
      checked: typeof p.checked === "object" && p.checked ? p.checked : {},
      custom: Array.isArray(p.custom) ? p.custom : [],
    }
  } catch {
    return { v: STORAGE_VERSION, checked: {}, custom: [] }
  }
}

function saveStored(data: StoredShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}

export function CommandCenterTodos({ className }: { className?: string } = {}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [custom, setCustom] = useState<CustomTodo[]>([])
  const [newTitle, setNewTitle] = useState("")
  const [hydrated, setHydrated] = useState(false)
  const [checklistCollapsed, setChecklistCollapsed] = useState(false)
  const [profileHint, setProfileHint] = useState<"loading" | "empty" | "ok">("loading")

  useEffect(() => {
    const s = loadStored()
    setChecked(s.checked)
    setCustom(s.custom)
    try {
      setChecklistCollapsed(localStorage.getItem(CHECKLIST_COLLAPSED_KEY) === "1")
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(CHECKLIST_COLLAPSED_KEY, checklistCollapsed ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [checklistCollapsed, hydrated])

  useEffect(() => {
    if (!hydrated) return
    saveStored({ v: STORAGE_VERSION, checked, custom })
  }, [checked, custom, hydrated])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const prRes = await fetch("/api/company/profile")
        if (cancelled) return
        const pr = prRes.ok ? await prRes.json() : { profile: null }
        const p = pr?.profile
        if (!p) setProfileHint("empty")
        else {
          const hasCore = Boolean(
            (p.company_name && String(p.company_name).trim()) ||
              (p.tagline && String(p.tagline).trim()) ||
              (p.problem && String(p.problem).trim()),
          )
          setProfileHint(hasCore ? "ok" : "empty")
        }
      } catch {
        if (!cancelled) {
          setProfileHint("empty")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = useCallback((id: string, next: boolean) => {
    setChecked((prev) => ({ ...prev, [id]: next }))
  }, [])

  const addCustom = useCallback(() => {
    const t = newTitle.trim()
    if (!t) return
    const id = `custom-${crypto.randomUUID()}`
    setCustom((prev) => [...prev, { id, title: t, done: false }])
    setNewTitle("")
  }, [newTitle])

  const removeCustom = useCallback((id: string) => {
    setCustom((prev) => prev.filter((x) => x.id !== id))
    setChecked((prev) => {
      const n = { ...prev }
      delete n[id]
      return n
    })
  }, [])

  const templateDone = TEMPLATE_TODOS.filter((t) => checked[t.id]).length
  const customDone = custom.filter((c) => c.done).length
  const totalSlots = TEMPLATE_TODOS.length + custom.length
  const doneSlots = templateDone + customDone
  const pct = totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 0

  const sortedCustom = useMemo(() => custom, [custom])

  const linkFor = (t: TemplateTodo) => {
    if (t.anchor) return `${t.href}#${t.anchor}`
    return t.href
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "rounded-xl border border-border bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden",
        className,
      )}
    >
      <div className={cn("p-4 bg-primary/[0.06]", !checklistCollapsed && "border-b border-border")}>
        <button
          type="button"
          onClick={() => setChecklistCollapsed((c) => !c)}
          className="flex w-full items-start justify-between gap-3 text-left rounded-lg -m-1 p-1 hover:bg-primary/5 transition-colors"
          aria-expanded={!checklistCollapsed}
          aria-controls="command-center-checklist-body"
          aria-label={checklistCollapsed ? "Expand operating checklist" : "Collapse operating checklist"}
        >
          <div className="flex items-start gap-2 min-w-0">
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 mt-0.5 text-muted-foreground transition-transform duration-200",
                checklistCollapsed && "-rotate-90",
              )}
              aria-hidden
            />
            <div>
              <h2 className="text-[14px] font-semibold text-foreground tracking-tight">Operating checklist</h2>
              {!checklistCollapsed && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  Setup steps and daily habits for this workspace.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[20px] font-semibold tabular-nums text-primary">{pct}%</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {doneSlots}/{totalSlots || TEMPLATE_TODOS.length}
            </span>
          </div>
        </button>
        {!checklistCollapsed && (
          <div className="mt-3 h-1.5 rounded-full bg-border overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            />
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {!checklistCollapsed && (
          <motion.div
            id="command-center-checklist-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {profileHint === "empty" && (
              <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed">
                <strong className="text-amber-100">Note:</strong> Add at least company name and problem so briefs have
                enough context.
              </div>
            )}

            <ul className="p-2 space-y-0.5 max-h-[min(70vh,520px)] overflow-y-auto border-b border-border">
        {TEMPLATE_TODOS.map((t) => {
          const Icon = t.icon
          const isDone = Boolean(checked[t.id])
          return (
            <li
              key={t.id}
              className={cn(
                "group rounded-lg px-2 py-2 flex gap-2.5 items-start transition-colors",
                "hover:bg-accent/40",
                isDone && "opacity-75",
              )}
            >
              <div className="pt-0.5">
                <Checkbox
                  checked={isDone}
                  onCheckedChange={(v) => toggle(t.id, v === true)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  aria-label={`Toggle ${t.title}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span
                    className={cn(
                      "text-[13px] font-medium text-foreground leading-tight",
                      isDone && "line-through text-muted-foreground",
                    )}
                  >
                    {t.title}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{t.hint}</p>
                <Link
                  href={linkFor(t)}
                  scroll={!t.anchor}
                  className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-primary hover:text-primary/80 font-medium"
                >
                  Open
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </li>
          )
        })}

        <AnimatePresence initial={false}>
          {sortedCustom.map((c) => (
            <motion.li
              key={c.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg px-2 py-2 flex gap-2.5 items-start hover:bg-accent/40 group border border-dashed border-border/80"
            >
              <div className="pt-0.5">
                <Checkbox
                  checked={c.done}
                  onCheckedChange={(v) =>
                    setCustom((prev) =>
                      prev.map((x) => (x.id === c.id ? { ...x, done: v === true } : x)),
                    )
                  }
                  aria-label={`Toggle ${c.title}`}
                />
              </div>
              <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "text-[13px] text-foreground leading-tight",
                    c.done && "line-through text-muted-foreground",
                  )}
                >
                  {c.title}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCustom(c.id)}
                  aria-label="Remove task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 border-t border-border bg-muted/20">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 font-medium">Your tasks</p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Follow up with design partner…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCustom()
              }
            }}
            className="h-9 text-[12px] bg-background"
          />
          <Button type="button" size="sm" className="h-9 px-3 shrink-0 gap-1" onClick={addCustom} disabled={!newTitle.trim()}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/80 mt-2">
          Checklist is saved in this browser. Use it for weekly priorities alongside Juno&apos;s automated work.
        </p>
      </div>
    </motion.div>
  )
}

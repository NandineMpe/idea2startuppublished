"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useRouter } from "next/navigation"
import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import {
  AlertTriangle,
  Coffee,
  Plus,
  ChevronRight,
  CheckCircle2,
  Clock,
  Send,
  ArrowLeft,
  FileText,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { OfficeHoursMode } from "@/lib/juno/office-hours-prompt"
import { extractPhase } from "@/lib/juno/office-hours-prompt"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

// ─── Types ────────────────────────────────────────────────────────

type SessionSummary = {
  id: string
  title: string
  /** Present after migration 034 */
  mode?: string | null
  created_at: string
  designDoc: { id: string; mode: string; status: string } | null
}

type DesignDocData = {
  title: string
  mode: string
  problemStatement?: string
  demandEvidence?: string
  targetUser?: string
  narrowestWedge?: string
  statusQuo?: string
  premises?: string[]
  approaches?: Array<{
    name: string
    effort: string
    risk: string
    summary: string
    pros: string[]
    cons: string[]
  }>
  recommendedApproach?: string
  openQuestions?: string[]
  successCriteria?: string[]
  theAssignment?: string
  founderObservations?: string[]
}

type DesignDoc = {
  id: string
  session_id: string
  mode: string
  title: string
  doc_data: DesignDocData
  status: string
  created_at: string
}

// ─── Phase config ─────────────────────────────────────────────────

const PHASES = [
  { key: "mode_selection", label: "Mode" },
  { key: "questioning", label: "Questions" },
  { key: "premise_challenge", label: "Premises" },
  { key: "alternatives", label: "Alternatives" },
  { key: "complete", label: "Design Doc" },
]

function phaseIndex(phase: string | null): number {
  if (!phase) return 0
  return PHASES.findIndex((p) => p.key === phase)
}

/** DB or titles may use different casing; keeps UI from losing activeMode (blank pane). */
function normalizeOfficeHoursMode(
  rowMode: string | null | undefined,
  title: string | undefined,
  docMode: string | null | undefined,
): OfficeHoursMode {
  const d = docMode?.toLowerCase()
  if (d === "builder" || d === "startup") return d

  const r = String(rowMode ?? "").toLowerCase()
  if (r === "builder" || r === "startup") return r as OfficeHoursMode

  const t = (title ?? "").toLowerCase()
  return t.includes("builder") ? "builder" : "startup"
}

// ─── Mode picker ──────────────────────────────────────────────────

function ModePicker({
  onSelect,
  startingMode,
}: {
  onSelect: (mode: OfficeHoursMode) => void
  startingMode: OfficeHoursMode | null
}) {
  const busy = startingMode !== null

  return (
    <div className="flex flex-col items-center justify-center gap-6 h-full py-16">
      <div className="text-center">
        <Coffee className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">What are we working on today?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a mode to start your session.
        </p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSelect("startup")}
          className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/50 hover:shadow-sm disabled:pointer-events-none disabled:opacity-60"
        >
          <div className="mb-3 flex items-center gap-2 text-2xl">
            🔬
            {startingMode === "startup" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <h3 className="mb-1.5 font-semibold text-foreground group-hover:text-primary">Startup Mode</h3>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Stress-test demand, find the specific user who needs this most, and discover the narrowest wedge you can ship for money.
          </p>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => onSelect("builder")}
          className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/50 hover:shadow-sm disabled:pointer-events-none disabled:opacity-60"
        >
          <div className="mb-3 flex items-center gap-2 text-2xl">
            🛠
            {startingMode === "builder" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <h3 className="mb-1.5 font-semibold text-foreground group-hover:text-primary">Builder Mode</h3>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Explore the coolest version, find what makes someone say &ldquo;whoa&rdquo;, and find the fastest path to something real.
          </p>
        </button>
      </div>
    </div>
  )
}

// ─── Design doc view ─────────────────────────────────────────────

function DesignDocView({ doc, onBack }: { doc: DesignDoc; onBack: () => void }) {
  const d = doc.doc_data

  return (
    <div className="space-y-5 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="font-semibold text-foreground">{d.title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[11px]">
              {d.mode === "startup" ? "🔬 Startup" : "🛠 Builder"}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {new Date(doc.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {d.theAssignment && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-900/10">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            The Assignment
          </p>
          <p className="text-[13px] font-medium text-foreground">{d.theAssignment}</p>
        </div>
      )}

      {d.problemStatement && (
        <Section title="Problem Statement">
          <p className="text-[13px] leading-relaxed text-foreground">{d.problemStatement}</p>
        </Section>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {d.targetUser && (
          <Section title="Target User">
            <p className="text-[13px] leading-relaxed text-foreground">{d.targetUser}</p>
          </Section>
        )}
        {d.narrowestWedge && (
          <Section title="Narrowest Wedge">
            <p className="text-[13px] leading-relaxed text-foreground">{d.narrowestWedge}</p>
          </Section>
        )}
        {d.demandEvidence && (
          <Section title="Demand Evidence">
            <p className="text-[13px] leading-relaxed text-foreground">{d.demandEvidence}</p>
          </Section>
        )}
        {d.statusQuo && (
          <Section title="Status Quo">
            <p className="text-[13px] leading-relaxed text-foreground">{d.statusQuo}</p>
          </Section>
        )}
      </div>

      {d.approaches && d.approaches.length > 0 && (
        <Section title="Approaches Considered">
          <div className="space-y-3">
            {d.approaches.map((a, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-3",
                  d.recommendedApproach?.includes(a.name)
                    ? "border-primary/40 bg-primary/5"
                    : "border-border",
                )}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">{a.name}</span>
                  {d.recommendedApproach?.includes(a.name) && (
                    <Badge className="text-[10px] bg-primary text-primary-foreground">Chosen</Badge>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {a.effort} effort · {a.risk} risk
                  </span>
                </div>
                <p className="mb-2 text-[12px] text-muted-foreground">{a.summary}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    {a.pros.map((p, j) => (
                      <p key={j} className="text-[12px] text-green-700 dark:text-green-400">+ {p}</p>
                    ))}
                  </div>
                  <div>
                    {a.cons.map((c, j) => (
                      <p key={j} className="text-[12px] text-red-600 dark:text-red-400">− {c}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.premises && d.premises.length > 0 && (
        <Section title="Premises Challenged">
          <ul className="space-y-1">
            {d.premises.map((p, i) => (
              <li key={i} className="text-[13px] text-foreground">• {p}</li>
            ))}
          </ul>
        </Section>
      )}

      {d.successCriteria && d.successCriteria.length > 0 && (
        <Section title="Success Criteria">
          <ul className="space-y-1">
            {d.successCriteria.map((c, i) => (
              <li key={i} className="text-[13px] text-foreground">• {c}</li>
            ))}
          </ul>
        </Section>
      )}

      {d.openQuestions && d.openQuestions.length > 0 && (
        <Section title="Open Questions">
          <ul className="space-y-1">
            {d.openQuestions.map((q, i) => (
              <li key={i} className="text-[13px] text-muted-foreground">? {q}</li>
            ))}
          </ul>
        </Section>
      )}

      {d.founderObservations && d.founderObservations.length > 0 && (
        <Section title="What I Noticed">
          <ul className="space-y-1">
            {d.founderObservations.map((o, i) => (
              <li key={i} className="text-[13px] text-foreground italic">&ldquo;{o}&rdquo;</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

/** Text + reasoning (models often stream reasoning without a text part until the end). */
function getMessageText(message: UIMessage): string {
  return message.parts
    .map((p) => {
      if (p.type === "text") return p.text
      if (p.type === "reasoning") return p.text
      return ""
    })
    .filter(Boolean)
    .join("\n\n")
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">{children}</CardContent>
    </Card>
  )
}

// ─── Active conversation ──────────────────────────────────────────

function ConversationPane({
  sessionId,
  mode,
  onDesignDocReady,
}: {
  sessionId: string
  mode: OfficeHoursMode
  onDesignDocReady: (docId: string) => void
}) {
  const [currentPhase, setCurrentPhase] = useState<string>("mode_selection")
  const [designDocReady, setDesignDocReady] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/office-hours",
        credentials: "include",
        body: { sessionId, mode },
      }),
    [sessionId, mode],
  )

  const { messages, sendMessage, status, setMessages, error } = useChat({
    // Recreate chat when mode changes (transport body); id alone only keyed sessionId before.
    id: `${sessionId}:${mode}`,
    transport,
    onFinish: ({ message }) => {
      const text = getMessageText(message)
      const phase = extractPhase(text)
      if (phase) setCurrentPhase(phase)

      if (text.includes("<<<DESIGN_DOC>>>")) {
        setDesignDocReady(true)
        setTimeout(() => {
          fetch(`/api/office-hours/design-doc?sessionId=${sessionId}`)
            .then((r) => r.json())
            .then((data: { doc?: DesignDoc | null }) => {
              if (data.doc?.id) onDesignDocReady(data.doc.id)
            })
            .catch(() => {})
        }, 1500)
      }
    },
  })

  const isLoading = status === "submitted" || status === "streaming"

  // Load saved thread, then open with a single starter message only if the session is empty.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}`, { credentials: "include" })
        const data = (await res.json()) as {
          messages?: Array<{ id: string; role: string; content: string }>
        }
        if (cancelled) return
        const rows = data.messages ?? []
        const uiMsgs: UIMessage[] = rows.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          parts: [{ type: "text" as const, text: m.content ?? "" }],
        }))
        setMessages(uiMsgs)
        if (uiMsgs.length === 0) {
          await sendMessage({
            text: `I'm ready to start ${mode === "startup" ? "Startup" : "Builder"} Mode Office Hours.`,
          })
        }
      } catch {
        if (!cancelled) {
          await sendMessage({
            text: `I'm ready to start ${mode === "startup" ? "Startup" : "Builder"} Mode Office Hours.`,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // setMessages / sendMessage are stable enough; including them can re-run this and duplicate the opener.
  }, [sessionId, mode])

  function submitMessage() {
    if (!input.trim() || isLoading || designDocReady) return
    const t = input.trim()
    setInput("")
    void sendMessage({ text: t })
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const currentPhaseIdx = phaseIndex(currentPhase)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Phase indicator */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        {PHASES.map((phase, i) => {
          const done = i < currentPhaseIdx
          const active = i === currentPhaseIdx
          return (
            <div key={phase.key} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  done
                    ? "bg-primary/10 text-primary"
                    : active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground",
                )}
              >
                {done && <CheckCircle2 className="h-3 w-3" />}
                {phase.label}
              </div>
              {i < PHASES.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
              )}
            </div>
          )
        })}
      </div>

      {/* Design doc ready banner */}
      {designDocReady && (
        <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 dark:border-amber-700/50 dark:bg-amber-900/10">
          <FileText className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
          <p className="text-[12px] font-medium text-amber-800 dark:text-amber-300">
            Design doc ready — saved to your session
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/5 px-4 py-2.5 text-[12px] text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p className="min-w-0 leading-relaxed">
            {error.message || "Could not reach the advisor. Check the network, API keys on the server, and try again."}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages
          .filter((m) => {
            const c = getMessageText(m)
            // Hide boilerplate opener only once the thread has more than this message (otherwise the pane looks blank).
            if (
              m.role === "user" &&
              c.includes("I'm ready to start") &&
              messages.indexOf(m) === 0 &&
              messages.length > 1
            ) {
              return false
            }
            return true
          })
          .map((m) => {
            const displayContent = getMessageText(m)
              .replace(/\[PHASE:\s*[a-z_]+\]\s*/g, "")
              .replace(/<<<DESIGN_DOC>>>[\s\S]*?<<<END_DOC>>>/g, "\n\n*[Design doc saved above ↑]*")
              .trim()

            return (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm",
                  )}
                >
                  {displayContent}
                </div>
              </div>
            )
          })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitMessage()
        }}
        className="border-t border-border p-3 flex gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Your answer…"
          rows={2}
          disabled={isLoading || designDocReady}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submitMessage()
            }
          }}
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !input.trim() || designDocReady}
          className="h-10 w-10 shrink-0 self-end"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────

export function OfficeHoursPageContent() {
  const { toast } = useToast()
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<OfficeHoursMode | null>(null)
  const [viewingDocId, setViewingDocId] = useState<string | null>(null)
  const [viewingDoc, setViewingDoc] = useState<DesignDoc | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [startingMode, setStartingMode] = useState<OfficeHoursMode | null>(null)

  const activeSession = useMemo(
    () => (activeSessionId ? sessions.find((s) => s.id === activeSessionId) : undefined),
    [sessions, activeSessionId],
  )

  const effectiveMode: OfficeHoursMode | null = useMemo(() => {
    if (activeMode) return activeMode
    if (!activeSession) return null
    return normalizeOfficeHoursMode(activeSession.mode, activeSession.title, activeSession.designDoc?.mode)
  }, [activeMode, activeSession])

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res = await fetch("/api/office-hours/sessions", { credentials: "include" })
      const data = (await res.json()) as { sessions: SessionSummary[] }
      setSessions(data.sessions ?? [])
    } catch {
      setSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  async function startSession(mode: OfficeHoursMode) {
    setStartingMode(mode)
    try {
      const res = await fetch("/api/office-hours/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode }),
      })
      let data: {
        session?: { id: string }
        mode?: OfficeHoursMode
        error?: string
        details?: string
        hint?: string
      } = {}
      try {
        data = (await res.json()) as typeof data
      } catch {
        // non-JSON body
      }

      if (res.status === 401) {
        toast({
          title: "Sign in required",
          description: "Your session expired or you are not logged in to the app.",
          variant: "destructive",
          action: (
            <ToastAction altText="Log in" onClick={() => router.push("/login")}>
              Log in
            </ToastAction>
          ),
        })
        return
      }

      if (!res.ok) {
        console.warn("[office-hours] POST /api/office-hours/sessions failed", res.status, data)
        const parts = [data.hint, data.details].filter(
          (s): s is string => typeof s === "string" && s.length > 0,
        )
        toast({
          title: "Could not start Office Hours",
          description:
            parts.length > 0
              ? parts.join(" ")
              : data.error ??
                (res.status >= 500
                  ? "Server error. Paste supabase/migrations/034_office_hours_live.sql in Supabase SQL (same project as NEXT_PUBLIC_SUPABASE_URL). Then 035_design_docs_office_hours_rls.sql if completion storage fails."
                  : `Request failed (${res.status}).`),
          variant: "destructive",
        })
        return
      }

      if (data.session?.id) {
        setActiveSessionId(data.session.id)
        setActiveMode(mode)
        setViewingDocId(null)
        setViewingDoc(null)
        void loadSessions()
        return
      }

      toast({
        title: "Could not start session",
        description: "No session was created. Try again or contact support.",
        variant: "destructive",
      })
    } catch (e) {
      toast({
        title: "Network error",
        description: e instanceof Error ? e.message : "Check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setStartingMode(null)
    }
  }

  async function viewDoc(docId: string) {
    setLoadingDoc(true)
    setViewingDocId(docId)
    try {
      const res = await fetch(`/api/office-hours/design-doc?all=true`)
      const data = (await res.json()) as { docs: DesignDoc[] }
      const found = data.docs.find((d) => d.id === docId)
      setViewingDoc(found ?? null)
    } catch {
      setViewingDoc(null)
    } finally {
      setLoadingDoc(false)
    }
  }

  function handleDesignDocReady(docId: string) {
    void loadSessions()
    void viewDoc(docId)
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Left panel — session list */}
      <div className="w-[240px] shrink-0 flex flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          <div className="flex items-center gap-2">
            <Coffee className="h-4 w-4 text-muted-foreground" />
            <span className="text-[13px] font-semibold text-foreground">Office Hours</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setActiveSessionId(null)
              setActiveMode(null)
              setViewingDocId(null)
              setViewingDoc(null)
            }}
            title="New session"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {sessionsLoading ? (
            <div className="space-y-1 p-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-md" />)}
            </div>
          ) : sessions.length === 0 ? (
            <p className="p-4 text-center text-[12px] text-muted-foreground">
              No sessions yet. Start one →
            </p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSessionId(s.id)
                  setActiveMode(normalizeOfficeHoursMode(s.mode, s.title, s.designDoc?.mode))
                  setViewingDocId(null)
                  setViewingDoc(null)
                }}
                className={cn(
                  "w-full px-3 py-2.5 text-left transition-colors hover:bg-accent",
                  activeSessionId === s.id && "bg-primary/5",
                )}
              >
                <p className="truncate text-[12px] font-medium text-foreground">{s.title}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {s.designDoc ? (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" /> Design doc ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> In progress
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {/* No active session — mode picker */}
        {!activeSessionId && (
          <ModePicker onSelect={startSession} startingMode={startingMode} />
        )}

        {/* Viewing design doc */}
        {activeSessionId && viewingDocId && (
          <div className="h-full overflow-y-auto p-6">
            {loadingDoc ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : viewingDoc ? (
              <DesignDocView
                doc={viewingDoc}
                onBack={() => { setViewingDocId(null); setViewingDoc(null) }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Design doc not found.</p>
            )}
          </div>
        )}

        {/* Active conversation */}
        {activeSessionId && !viewingDocId && effectiveMode && (
          <ConversationPane
            key={`${activeSessionId}-${effectiveMode}`}
            sessionId={activeSessionId}
            mode={effectiveMode}
            onDesignDocReady={(docId) => {
              void loadSessions()
              void viewDoc(docId)
            }}
          />
        )}

        {activeSessionId && !viewingDocId && !effectiveMode && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading session…
          </div>
        )}
      </div>
    </div>
  )
}

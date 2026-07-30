"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AudioLines, MessageSquare, Volume2, VolumeX } from "lucide-react"
import { CareerOsIcon } from "@/components/careeros/icon"
import { CareerConvaiWidget } from "@/components/careeros/career-convai-widget"
import { CAREEROS_CONVAI_AGENT_ID } from "@/lib/voice/careeros-convai-agent"
import { stripCareerChatMarkdown } from "@/lib/careeros/chat-format"
import { JunoBlueDotMark } from "@/components/juno/blue-dot-mark"
import { playSpeechFromTtsRoute, stopSpeechPlayback, unlockAudioContext } from "@/lib/voice/playback"
import { cn } from "@/lib/utils"

type Message = { role: "user" | "assistant"; content: string }

type ChatSession = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

type View = "chat" | "history"
type InteractionMode = "text" | "voice"

type VoiceCapabilities = {
  ttsAvailable: boolean
  voiceAgentAvailable: boolean
  agentConfigured: boolean
}

const SUGGESTIONS = [
  "Could I move into AI governance from privacy?",
  "Am I being underpaid for 3 PQE?",
  "What if I moved to Berlin?",
  "Is my role still going to exist in five years?",
  "Who's hiring people like me right now?",
]

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

type CareerBrainChatProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CareerBrainChat({ open, onOpenChange }: CareerBrainChatProps) {
  const [view, setView] = useState<View>("chat")
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("text")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [convaiSession, setConvaiSession] = useState<{
    signedUrl?: string | null
    careerContextSnippet?: string
  } | null>(null)
  const [voiceCaps, setVoiceCaps] = useState<VoiceCapabilities>({
    ttsAvailable: false,
    voiceAgentAvailable: Boolean(CAREEROS_CONVAI_AGENT_ID),
    agentConfigured: Boolean(CAREEROS_CONVAI_AGENT_ID),
  })
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const voiceEnabledRef = useRef(voiceEnabled)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled
  }, [voiceEnabled])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    if (open && view === "chat" && interactionMode === "text") scrollToBottom()
  }, [messages, open, view, interactionMode, scrollToBottom])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) {
      stopSpeechPlayback()
      setIsSpeaking(false)
      setInteractionMode("text")
      return
    }
    let cancelled = false
    void fetch("/api/careeros/voice/session", { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json()) as VoiceCapabilities & {
          signedUrl?: string | null
          careerContextSnippet?: string
          error?: string
        }
        if (!cancelled && res.ok) {
          setConvaiSession({
            signedUrl: data.signedUrl ?? null,
            careerContextSnippet: data.careerContextSnippet,
          })
          setVoiceCaps({
            ttsAvailable: Boolean(data.ttsAvailable),
            voiceAgentAvailable: Boolean(CAREEROS_CONVAI_AGENT_ID),
            agentConfigured: Boolean(data.agentConfigured ?? CAREEROS_CONVAI_AGENT_ID),
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVoiceCaps({
            ttsAvailable: false,
            voiceAgentAvailable: false,
            agentConfigured: false,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const res = await fetch("/api/careeros/chat/sessions", { credentials: "include" })
      const data = (await res.json()) as { sessions?: ChatSession[] }
      setSessions(data.sessions ?? [])
    } catch {
      setSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const loadSession = useCallback(async (session: ChatSession) => {
    try {
      const res = await fetch(`/api/careeros/chat/sessions/${session.id}`, {
        credentials: "include",
      })
      const data = (await res.json()) as { messages?: { role: string; content: string }[] }
      const loaded: Message[] = (data.messages ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content:
          m.role === "assistant" ? stripCareerChatMarkdown(m.content) : m.content,
      }))
      setMessages(loaded.length > 0 ? loaded : [])
      setSessionId(session.id)
      setView("chat")
    } catch {
      setView("chat")
    }
  }, [])

  const deleteSession = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await fetch(`/api/careeros/chat/sessions/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (sessionId === id) {
        setSessionId(null)
        setMessages([])
      }
    } catch {
      // silent
    }
  }, [sessionId])

  const startNewChat = useCallback(() => {
    setMessages([])
    setSessionId(null)
    setView("chat")
  }, [])

  const ensureSession = useCallback(async (firstMessage: string): Promise<string | null> => {
    if (sessionId) return sessionId
    try {
      const title = firstMessage.slice(0, 60) || "Career chat"
      const res = await fetch("/api/careeros/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title }),
      })
      const data = (await res.json()) as { session?: { id: string } }
      if (data.session?.id) {
        setSessionId(data.session.id)
        return data.session.id
      }
    } catch {
      // not logged in
    }
    return null
  }, [sessionId])

  const speakReply = useCallback(async (reply: string) => {
    if (!voiceEnabledRef.current || !reply.trim()) return
    setIsSpeaking(true)
    stopSpeechPlayback()
    await playSpeechFromTtsRoute(reply, {
      onEnd: () => setIsSpeaking(false),
    })
  }, [])

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim()
      if (!text || isLoading) return

      const userMessage: Message = { role: "user", content: text }
      const isFirstUserMessage = messages.filter((m) => m.role === "user").length === 0

      setMessages((prev) => [...prev, userMessage])
      setInput("")
      setIsLoading(true)

      let activeSessionId = sessionId
      if (isFirstUserMessage) {
        activeSessionId = await ensureSession(userMessage.content)
      }

      try {
        const res = await fetch("/api/careeros/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messages: [...messages, userMessage],
            sessionId: activeSessionId,
          }),
        })

        const raw = await res.text()
        let data: { text?: string; error?: string } = {}
        try {
          data = raw ? (JSON.parse(raw) as { text?: string; error?: string }) : {}
        } catch {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Could not read the response (HTTP ${res.status}). Try again.`,
            },
          ])
          return
        }

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.error?.trim() || `Request failed (HTTP ${res.status}).`,
            },
          ])
          return
        }

      const reply = data.text?.trim()
        ? stripCareerChatMarkdown(data.text.trim())
        : ""
      const assistantText = reply || "Empty reply. Try again?"
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantText,
        },
      ])
      if (voiceCaps.ttsAvailable) {
        await speakReply(assistantText)
      }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Network error. Check your connection and try again." },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, messages, sessionId, ensureSession, voiceCaps.ttsAvailable, speakReply],
  )

  const enterVoiceMode = useCallback(() => {
    stopSpeechPlayback()
    setInteractionMode("voice")
  }, [])

  const exitVoiceMode = useCallback(() => {
    setInteractionMode("text")
  }, [])

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close chat backdrop"
            className="fixed inset-0 z-[60] bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.aside
            role="dialog"
            aria-label="Juno CareerOS chat"
            className="career-brain-chat fixed right-0 top-0 z-[70] flex h-full w-full max-w-[420px] flex-col border-l border-border bg-background shadow-xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                {view === "history" ? (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Back to chat"
                    onClick={() => setView("chat")}
                  >
                    <CareerOsIcon name="chevron-left" size={18} />
                  </button>
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center">
                    <JunoBlueDotMark className="h-3.5 w-3.5" />
                  </span>
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">Juno CareerOS</p>
                  <p className="text-xs text-muted-foreground">
                    {interactionMode === "voice" ? "Voice agent · interrupt anytime" : "Profile, pay, moves, hiring"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {view === "chat" && voiceCaps.voiceAgentAvailable && (
                  <button
                    type="button"
                    className={cn("icon-btn", interactionMode === "voice" && "text-primary")}
                    title={interactionMode === "voice" ? "Switch to text chat" : "Switch to voice agent"}
                    onClick={() => {
                      if (interactionMode === "voice") exitVoiceMode()
                      else enterVoiceMode()
                    }}
                  >
                    {interactionMode === "voice" ? (
                      <MessageSquare size={16} />
                    ) : (
                      <AudioLines size={16} />
                    )}
                  </button>
                )}
                {view === "chat" && interactionMode === "text" && voiceCaps.ttsAvailable && (
                  <button
                    type="button"
                    className="icon-btn"
                    title={voiceEnabled ? "Mute read-aloud" : "Read replies aloud"}
                    onClick={() => {
                      unlockAudioContext()
                      if (voiceEnabled) stopSpeechPlayback()
                      setVoiceEnabled((v) => !v)
                    }}
                  >
                    {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  title="History"
                  onClick={() => {
                    setView("history")
                    void fetchSessions()
                  }}
                >
                  <CareerOsIcon name="clock" size={16} />
                </button>
                <button type="button" className="icon-btn" title="New chat" onClick={startNewChat}>
                  <CareerOsIcon name="plus" size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Close"
                  onClick={() => onOpenChange(false)}
                >
                  <CareerOsIcon name="x" size={16} />
                </button>
              </div>
            </header>

            {view === "history" ? (
              <div className="custom-scrollbar flex-1 overflow-y-auto p-3">
                {loadingSessions ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No past chats yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {sessions.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/60"
                          onClick={() => void loadSession(s)}
                        >
                          <span className="truncate font-medium">{s.title}</span>
                          <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                            {formatRelativeTime(s.updated_at)}
                            <span
                              role="button"
                              tabIndex={0}
                              className="text-muted-foreground hover:text-destructive"
                              onClick={(e) => void deleteSession(e, s.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void deleteSession(e as unknown as React.MouseEvent, s.id)
                              }}
                              aria-label="Delete chat"
                            >
                              <CareerOsIcon name="trash" size={14} />
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : interactionMode === "voice" ? (
              <CareerConvaiWidget session={convaiSession ?? undefined} className="min-h-0 flex-1" />
            ) : (
              <>
                <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-3">
                  {messages.map((m, i) => (
                    <div
                      key={`${i}-${m.role}`}
                      className={cn(
                        "max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                        m.role === "user"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "mr-auto bg-muted text-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap">
                        {m.role === "assistant" ? stripCareerChatMarkdown(m.content) : m.content}
                      </p>
                    </div>
                  ))}
                  {isLoading && (
                    <p className="text-xs text-muted-foreground">Thinking…</p>
                  )}
                  {isSpeaking && !isLoading && (
                    <p className="text-xs text-muted-foreground">Speaking…</p>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {messages.length === 0 && (
                  <div className="flex flex-wrap gap-2 px-4 pb-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground hover:bg-muted"
                        onClick={() => void handleSend(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <form
                  className="flex shrink-0 gap-2 border-t border-border p-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void handleSend()
                  }}
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="What's on your mind?"
                    className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                    aria-label="Send"
                  >
                    <CareerOsIcon name="send" size={16} />
                  </button>
                </form>
              </>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {!open && (
        <button
          type="button"
          className="fixed bottom-6 right-6 z-50 flex h-12 items-center gap-2.5 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground shadow-lg hover:bg-muted/80"
          onClick={() => onOpenChange(true)}
          aria-label="Open Juno CareerOS chat"
        >
          <JunoBlueDotMark className="h-3 w-3" />
          Juno CareerOS
        </button>
      )}
    </>
  )
}

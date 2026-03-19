"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Loader2,
  Minimize2,
  Maximize2,
  History,
  Plus,
  ChevronLeft,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
}

type View = "chat" | "history"

const WELCOME: Message = {
  role: "assistant",
  content: "Hey! I'm Juno, your startup sidekick. How can I help you build today?",
}

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

export default function FloatingJuno() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [view, setView] = useState<View>("chat")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    if (isOpen && !isMinimized && view === "chat") {
      scrollToBottom()
    }
  }, [messages, isOpen, isMinimized, view, scrollToBottom])

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const res = await fetch("/api/chat/sessions")
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {
      // Silent — user might not be logged in
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const openHistory = useCallback(() => {
    setView("history")
    fetchSessions()
  }, [fetchSessions])

  const loadSession = useCallback(async (session: ChatSession) => {
    try {
      const res = await fetch(`/api/chat/sessions/${session.id}`)
      const data = await res.json()
      const loaded: Message[] = (data.messages || []).map(
        (m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }),
      )
      setMessages(loaded.length > 0 ? loaded : [WELCOME])
      setSessionId(session.id)
      setView("chat")
    } catch {
      setView("chat")
    }
  }, [])

  const deleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation()
      try {
        await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" })
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      } catch {
        // Silent
      }
    },
    [],
  )

  const startNewChat = useCallback(() => {
    setMessages([WELCOME])
    setSessionId(null)
    setView("chat")
  }, [])

  const ensureSession = useCallback(async (firstMessage: string): Promise<string | null> => {
    if (sessionId) return sessionId
    try {
      const title = firstMessage.slice(0, 60) || "New conversation"
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      const data = await res.json()
      if (data.session?.id) {
        setSessionId(data.session.id)
        return data.session.id
      }
    } catch {
      // User might not be logged in — that's OK
    }
    return null
  }, [sessionId])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: "user", content: input.trim() }
    const isFirstUserMessage = messages.filter((m) => m.role === "user").length === 0

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Create a session if this is the first user message
    let activeSessionId = sessionId
    if (isFirstUserMessage) {
      activeSessionId = await ensureSession(userMessage.content)
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          sessionId: activeSessionId,
        }),
      })

      if (!res.ok) throw new Error("Failed to get response")

      const data = await res.json()
      setMessages((prev) => [...prev, { role: "assistant", content: data.text }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I hit a snag. Let's try that again?" },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, sessionId, ensureSession])

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "mb-3 w-[360px] rounded-xl border border-border bg-card shadow-xl overflow-hidden flex flex-col",
              isMinimized ? "h-[52px]" : "h-[500px]",
            )}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                {view === "history" ? (
                  <button
                    onClick={() => setView("chat")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    {view === "history" ? "Conversation History" : "Juno"}
                  </p>
                  {view === "chat" && (
                    <p className="text-[10px] text-muted-foreground leading-none">AI Sidekick</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {view === "chat" && !isMinimized && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={startNewChat}
                      title="New chat"
                    >
                      <Plus size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={openHistory}
                      title="Chat history"
                    >
                      <History size={13} />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsMinimized(!isMinimized)}
                >
                  {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsOpen(false)}
                >
                  <X size={14} />
                </Button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* History View */}
                {view === "history" && (
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-3 border-b border-border shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-[12px] h-8 gap-1.5"
                        onClick={startNewChat}
                      >
                        <Plus size={13} />
                        New conversation
                      </Button>
                    </div>
                    <ScrollArea className="flex-1">
                      {loadingSessions ? (
                        <div className="flex items-center justify-center p-8 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : sessions.length === 0 ? (
                        <div className="p-6 text-center">
                          <p className="text-[12px] text-muted-foreground">No saved conversations yet.</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Sign in to save your chat history.
                          </p>
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {sessions.map((session) => (
                            <div
                              key={session.id}
                              onClick={() => loadSession(session)}
                              className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-medium text-foreground truncate">
                                  {session.title}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {formatRelativeTime(session.updated_at)}
                                </p>
                              </div>
                              <button
                                onClick={(e) => deleteSession(e, session.id)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}

                {/* Chat View */}
                {view === "chat" && (
                  <>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-3">
                        {messages.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] px-3 py-2 rounded-lg text-[13px] leading-relaxed",
                                msg.role === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground",
                              )}
                            >
                              {msg.content}
                            </div>
                          </div>
                        ))}
                        {isLoading && (
                          <div className="flex justify-start">
                            <div className="bg-muted px-3 py-2 rounded-lg flex items-center gap-2">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                              <span className="text-[12px] text-muted-foreground">Thinking...</span>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>

                    <div className="p-3 border-t border-border shrink-0">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ask Juno anything..."
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSend()}
                          className="text-[13px] h-9 bg-muted border-border focus:border-primary"
                        />
                        <Button
                          onClick={handleSend}
                          disabled={isLoading || !input.trim()}
                          size="sm"
                          className="h-9 w-9 p-0 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                        >
                          <Send size={14} />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
      >
        {isOpen ? <X size={20} /> : <MessageCircle size={20} />}
      </motion.button>
    </div>
  )
}

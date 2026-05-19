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
  Mic,
  MicOff,
  Volume2,
  VolumeX,
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
  content: "Hi Nano, what's up? Ask me anything — strategy, GTM, product, or whatever's on your mind.",
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

async function speakText(text: string): Promise<void> {
  try {
    const res = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
    if (!res.ok || !res.body) return

    // Stream audio — start playing as soon as first chunk arrives
    const mediaSource = new MediaSource()
    const url = URL.createObjectURL(mediaSource)
    const audio = new Audio(url)

    await new Promise<void>((resolve, reject) => {
      mediaSource.addEventListener("sourceopen", async () => {
        const mime = 'audio/mpeg'
        if (!MediaSource.isTypeSupported(mime)) {
          // Fallback: buffer the whole response
          URL.revokeObjectURL(url)
          const blob = await res.clone().blob()
          const fallbackUrl = URL.createObjectURL(blob)
          const fallback = new Audio(fallbackUrl)
          fallback.onended = () => URL.revokeObjectURL(fallbackUrl)
          await fallback.play()
          resolve()
          return
        }

        const sb = mediaSource.addSourceBuffer(mime)
        const reader = res.body!.getReader()

        const pump = async () => {
          const { done, value } = await reader.read()
          if (done) {
            if (!sb.updating) mediaSource.endOfStream()
            else sb.addEventListener("updateend", () => mediaSource.endOfStream(), { once: true })
            return
          }
          if (sb.updating) {
            await new Promise(r => sb.addEventListener("updateend", r, { once: true }))
          }
          sb.appendBuffer(value)
          sb.addEventListener("updateend", pump, { once: true })
        }

        audio.play().then(() => resolve()).catch(reject)
        await pump()
      }, { once: true })

      audio.onerror = reject
    })

    audio.onended = () => URL.revokeObjectURL(url)
  } catch {
    // Silently fail — voice is a nice-to-have
  }
}

export default function FloatingJuno() {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [view, setView] = useState<View>("chat")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [chatAuthenticated, setChatAuthenticated] = useState<boolean | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Voice state
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const spokenCountRef = useRef(0)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    if (isOpen && view === "chat") {
      scrollToBottom()
    }
  }, [messages, isOpen, view, scrollToBottom])

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const res = await fetch("/api/chat/sessions?channel=sidekick", { credentials: "include" })
      const data = (await res.json()) as { authenticated?: boolean; sessions?: ChatSession[] }
      setChatAuthenticated(data.authenticated === true)
      setSessions(data.sessions || [])
    } catch {
      setChatAuthenticated(false)
      setSessions([])
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
      const res = await fetch(`/api/chat/sessions/${session.id}`, { credentials: "include" })
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
        await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE", credentials: "include" })
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
    spokenCountRef.current = 0
  }, [])

  const ensureSession = useCallback(async (firstMessage: string): Promise<string | null> => {
    if (sessionId) return sessionId
    try {
      const title = firstMessage.slice(0, 60) || "New conversation"
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, channel: "sidekick" }),
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

  const handleSend = useCallback(async (overrideText?: string) => {
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
      const res = await fetch("/api/chat", {
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
            content: `Could not read the response (HTTP ${res.status}). Try again in a moment.`,
          },
        ])
        return
      }

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.error?.trim() ||
              (res.status === 500
                ? "Server error. If this keeps happening, check that LLM API keys are set for this app."
                : `Request failed (HTTP ${res.status}). Try again.`),
          },
        ])
        return
      }

      const reply = data.text?.trim()
      if (!reply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Got an empty reply. Try asking again?" },
        ])
        return
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply }])

      // Speak the reply via ElevenLabs
      if (voiceEnabled) {
        setIsSpeaking(true)
        await speakText(reply)
        setIsSpeaking(false)
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error. Check your connection and try again." },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, sessionId, ensureSession, voiceEnabled])

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition =
      (window as typeof window & { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ||
      (window as typeof window & { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Try Chrome.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
      setIsListening(false)
      // Auto-send after voice input
      void handleSend(transcript)
    }

    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening, handleSend])

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "fixed top-0 right-0 h-screen border-l border-border bg-card shadow-xl overflow-hidden flex flex-col transition-all duration-300",
              isExpanded ? "w-[720px]" : "w-[380px]",
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
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {view === "history" ? "Chat history" : "Juno"}
                  </p>
                  {view === "chat" && (
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Any topic
                    </p>
                  )}
                  {view === "history" && (
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 pr-2">
                      Only chats started from this button
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {view === "chat" && (
                  <>
                    {/* Voice mute toggle */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setVoiceEnabled(v => !v)}
                      title={voiceEnabled ? "Mute voice responses" : "Enable voice responses"}
                    >
                      {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                    </Button>
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
                      title="History"
                    >
                      <History size={13} />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsExpanded(!isExpanded)}
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
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

            <>
                {/* History View */}
                {view === "history" && (
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-3 border-b border-border shrink-0 space-y-2">
                      <p className="text-[10px] text-muted-foreground leading-snug px-0.5">
                        <span className="font-medium text-foreground/90">Different from Context:</span> chats on{" "}
                        <span className="whitespace-nowrap">Context → Update context</span> are saved under the clock icon in
                        that dialog, not here.
                      </p>
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
                          {chatAuthenticated === false ? (
                            <>
                              <p className="text-[12px] text-muted-foreground">No saved conversations yet.</p>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                Sign in to save your chat history.
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[12px] text-muted-foreground">No chats yet.</p>
                              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                                Send a message in this sidebar to create a thread here. Chats from{" "}
                                <span className="font-medium text-foreground/80">Context → Update context</span> appear only
                                there (clock icon in that dialog).
                              </p>
                            </>
                          )}
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
                        {isSpeaking && (
                          <div className="flex justify-start">
                            <div className="bg-muted px-3 py-2 rounded-lg flex items-center gap-1.5">
                              <span className="flex gap-0.5 items-end h-3">
                                {[0, 1, 2].map((i) => (
                                  <span
                                    key={i}
                                    className="w-0.5 bg-primary rounded-full animate-pulse"
                                    style={{ height: `${6 + i * 3}px`, animationDelay: `${i * 150}ms` }}
                                  />
                                ))}
                              </span>
                              <span className="text-[12px] text-muted-foreground">Speaking...</span>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>

                    <div className="p-3 border-t border-border shrink-0">
                      <div className="flex gap-2">
                        <Input
                          placeholder={isListening ? "Listening..." : "Ask anything..."}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && void handleSend()}
                          className={cn(
                            "text-[13px] h-9 bg-muted border-border focus:border-primary",
                            isListening && "border-primary/60",
                          )}
                        />
                        {/* Mic button */}
                        <Button
                          type="button"
                          onClick={toggleListening}
                          size="sm"
                          variant={isListening ? "default" : "outline"}
                          className={cn(
                            "h-9 w-9 p-0 shrink-0",
                            isListening && "bg-primary text-primary-foreground animate-pulse",
                          )}
                          title={isListening ? "Stop listening" : "Speak your message"}
                        >
                          {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                        </Button>
                        {/* Send button */}
                        <Button
                          onClick={() => void handleSend()}
                          disabled={isLoading || !input.trim()}
                          size="sm"
                          className="h-9 w-9 p-0 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                        >
                          <Send size={14} />
                        </Button>
                      </div>
                      {isListening && (
                        <p className="text-[10px] text-primary/70 mt-1.5 text-center animate-pulse">
                          Listening — speak now, then pause to send
                        </p>
                      )}
                    </div>
                  </>
                )}
            </>
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

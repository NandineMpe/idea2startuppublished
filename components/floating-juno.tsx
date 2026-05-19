"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  Send,
  Sparkles,
  Minimize2,
  Maximize2,
  History,
  Plus,
  ChevronLeft,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { VoiceInput } from "@/components/ui/voice-input"
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

let _audioCtx: AudioContext | null = null
let _audioSource: AudioBufferSourceNode | null = null

/** Must be called synchronously inside a click handler — before any await. */
function ensureAudioContext() {
  if (!_audioCtx || _audioCtx.state === "closed") {
    _audioCtx = new AudioContext()
  }
  if (_audioCtx.state === "suspended") {
    _audioCtx.resume()
  }
}

function unlockAudio() {
  ensureAudioContext()
}

function stopCurrentAudio() {
  try { _audioSource?.stop() } catch {}
  _audioSource = null
}

async function speakViaTTS(text: string, onEnd: () => void): Promise<void> {
  stopCurrentAudio()
  const ctx = _audioCtx
  if (!ctx) { onEnd(); return }

  try {
    const res = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) { onEnd(); return }

    const arrayBuffer = await res.arrayBuffer()
    if (ctx.state === "suspended") await ctx.resume()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    source.onended = onEnd
    _audioSource = source
    source.start(0)
  } catch {
    onEnd()
  }
}

export default function FloatingJuno() {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const expandedWidth = typeof window !== "undefined" ? window.innerWidth - 172 : 900
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
  const voiceEnabledRef = useRef(voiceEnabled)

  // Keep ref in sync so handleSend closure always reads current value
  useEffect(() => { voiceEnabledRef.current = voiceEnabled }, [voiceEnabled])

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
    stopCurrentAudio()
    setIsSpeaking(false)
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

    // Must be synchronous — before any await — to count as user gesture
    if (voiceEnabledRef.current) ensureAudioContext()

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
      if (voiceEnabledRef.current) {
        setIsSpeaking(true)
        try {
          await speakViaTTS(reply, () => setIsSpeaking(false))
        } catch {
          setIsSpeaking(false)
        }
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
            initial={{ opacity: 0, x: 20, width: 380 }}
            animate={{ opacity: 1, x: 0, width: isExpanded ? expandedWidth : 380 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 h-screen border-l border-border bg-card shadow-xl overflow-hidden flex flex-col"
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
                    {/* Test voice — direct click → plays immediately */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Test ElevenLabs voice"
                      onClick={async () => {
                        ensureAudioContext()
                        const ctx = _audioCtx
                        if (!ctx) return
                        try {
                          const res = await fetch("/api/voice/tts", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ text: "Hey, Juno here. Voice is working." }),
                          })
                          if (!res.ok) { alert(`TTS API error: ${res.status}`); return }
                          const ab = await res.arrayBuffer()
                          if (ctx.state === "suspended") await ctx.resume()
                          const buf = await ctx.decodeAudioData(ab)
                          const src = ctx.createBufferSource()
                          src.buffer = buf
                          src.connect(ctx.destination)
                          src.start(0)
                        } catch (e) {
                          alert(`Voice error: ${e}`)
                        }
                      }}
                    >
                      <span className="text-[10px] font-bold">▶</span>
                    </Button>
                    {/* Voice mute toggle */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        unlockAudio()
                        setVoiceEnabled(v => {
                          const next = !v
                          voiceEnabledRef.current = next
                          if (!next) {
                            stopCurrentAudio()
                            setIsSpeaking(false)
                          }
                          return next
                        })
                      }}
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
                          <div className="flex justify-start py-2 pl-1">
                            <div className="relative flex items-center justify-center w-9 h-9">
                              {/* Spinning gradient ring */}
                              <div
                                className="absolute inset-0 rounded-full animate-spin"
                                style={{
                                  background: "conic-gradient(from 0deg, rgb(186,66,255), rgb(0,225,255), rgb(186,66,255))",
                                  animationDuration: "1.7s",
                                  animationTimingFunction: "linear",
                                }}
                              />
                              {/* Glow layer */}
                              <div
                                className="absolute inset-0 rounded-full"
                                style={{
                                  boxShadow: "0 0 8px 2px rgb(186,66,255,0.5), 0 0 8px 2px rgb(0,225,255,0.4)",
                                }}
                              />
                              {/* Sharp dark inner circle */}
                              <div className="absolute inset-[3px] rounded-full bg-card" />
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
                          placeholder="Ask anything..."
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { unlockAudio(); void handleSend() } }}
                          className="text-[13px] h-9 bg-muted border-border focus:border-primary"
                        />
                        {/* Mic button */}
                        <VoiceInput
                          onStart={() => {
                            unlockAudio()
                            if (!isListening) toggleListening()
                          }}
                          onStop={() => {
                            if (isListening) {
                              recognitionRef.current?.stop()
                              setIsListening(false)
                            }
                          }}
                        />
                        {/* Send button */}
                        <Button
                          onClick={() => { unlockAudio(); void handleSend() }}
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
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => { unlockAudio(); setIsOpen(!isOpen) }}
        className="relative flex items-center justify-center w-14 h-14 rounded-full focus:outline-none"
        aria-label={isOpen ? "Close Juno" : "Open Juno"}
        animate={{ opacity: isOpen ? 0 : 1, pointerEvents: isOpen ? "none" : "auto" }}
        transition={{ duration: 0.15 }}
      >
        {/* Spinning gradient ring */}
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            background: "conic-gradient(from 0deg, rgb(186,66,255), rgb(0,225,255), rgb(186,66,255))",
            animationDuration: "1.7s",
            animationTimingFunction: "linear",
          }}
        />
        {/* Glow */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: "0 0 18px 4px rgba(186,66,255,0.55), 0 0 18px 4px rgba(0,225,255,0.45)",
          }}
        />
        {/* Inner dark circle with icon */}
        <div className="absolute inset-[3px] rounded-full bg-[rgb(22,22,22)] flex items-center justify-center">
          {isOpen
            ? <X size={18} className="text-white" />
            : <Sparkles size={16} className="text-white" />
          }
        </div>
      </motion.button>
    </div>
  )
}

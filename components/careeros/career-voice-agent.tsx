"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Conversation } from "@elevenlabs/client"
import type { VoiceConversation } from "@elevenlabs/client"
import { Mic, MicOff } from "lucide-react"
import { CareerOsIcon } from "@/components/careeros/icon"
import { JunoBlueDotMark } from "@/components/juno/blue-dot-mark"
import { cn } from "@/lib/utils"

export type VoiceAgentMessage = { role: "user" | "assistant"; content: string }

type VoiceSessionPayload = {
  voiceAgentAvailable?: boolean
  conversationToken?: string | null
  signedUrl?: string | null
  connectionType?: "webrtc" | "websocket" | null
  careerContextSnippet?: string
  agentConfigured?: boolean
  error?: string
}

type TurnState = "connecting" | "listening" | "speaking" | "interrupted" | "idle" | "error"

type CareerVoiceAgentProps = {
  onClose: () => void
  messages: VoiceAgentMessage[]
  onMessagesChange: (messages: VoiceAgentMessage[]) => void
}

export function CareerVoiceAgent({ onClose, messages, onMessagesChange }: CareerVoiceAgentProps) {
  const [turn, setTurn] = useState<TurnState>("connecting")
  const [error, setError] = useState<string | null>(null)
  const [micMuted, setMicMuted] = useState(false)
  const interruptedRef = useRef(false)
  const conversationRef = useRef<VoiceConversation | null>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const upsertMessage = useCallback(
    (role: "user" | "assistant", content: string, replaceLastAgent = false) => {
      const trimmed = content.trim()
      if (!trimmed) return
      const prev = messagesRef.current
      const last = prev[prev.length - 1]
      if (replaceLastAgent && last?.role === "assistant") {
        onMessagesChange([...prev.slice(0, -1), { role: "assistant", content: trimmed }])
        return
      }
      if (last?.role === role && last.content === trimmed) return
      onMessagesChange([...prev, { role, content: trimmed }])
    },
    [onMessagesChange],
  )

  const endSession = useCallback(async () => {
    const conv = conversationRef.current
    conversationRef.current = null
    if (conv) {
      try {
        await conv.endSession()
      } catch {
        // already ended
      }
    }
    setTurn("idle")
  }, [])

  useEffect(() => {
    let active = true

    async function connect() {
      setError(null)
      setTurn("connecting")

      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        if (!active) return
        setTurn("error")
        setError("Microphone access is required for voice mode.")
        return
      }

      let session: VoiceSessionPayload
      try {
        const res = await fetch("/api/careeros/voice/session", { credentials: "include" })
        session = (await res.json()) as VoiceSessionPayload
        if (!res.ok) throw new Error(session.error ?? `Session failed (${res.status})`)
      } catch (e) {
        if (!active) return
        setTurn("error")
        setError(e instanceof Error ? e.message : "Could not start voice session.")
        return
      }

      if (!active) return

      if (!session.voiceAgentAvailable) {
        setTurn("error")
        setError(
          session.agentConfigured
            ? "Voice agent could not connect. Check ELEVENLABS_API_KEY and agent ID."
            : "Add ELEVENLABS_CAREEROS_AGENT_ID in Vercel, then point the agent Custom LLM to /api/careeros/voice/llm/v1/chat/completions.",
        )
        return
      }

      const sessionBase = {
        dynamicVariables: {
          career_context: session.careerContextSnippet ?? "",
        },
        overrides: {
          agent: {
            firstMessage: "What's on your mind about your career?",
          },
        },
        clientTools: {
          career_brain_ask: async (parameters: { message?: string }) => {
            const question =
              typeof parameters?.message === "string" ? parameters.message.trim() : ""
            if (!question) return "No question was provided."

            const res = await fetch("/api/careeros/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                messages: [...messagesRef.current, { role: "user", content: question }],
              }),
            })
            const data = (await res.json()) as { text?: string; error?: string }
            if (!res.ok) return data.error ?? "Career brain request failed."
            const text = data.text?.trim() || "I don't have an answer for that yet."
            upsertMessage("assistant", text)
            return text
          },
        },
        onConnect: () => {
          if (active) setTurn("listening")
        },
        onDisconnect: () => {
          if (!active) return
          setTurn("idle")
          conversationRef.current = null
        },
        onError: (message) => {
          if (!active) return
          setTurn("error")
          setError(message)
        },
        onMessage: ({ message, role }) => {
          upsertMessage(role === "user" ? "user" : "assistant", message)
        },
        onModeChange: ({ mode }) => {
          if (!active) return
          if (mode === "speaking") setTurn("speaking")
          else if (mode === "listening") {
            setTurn(interruptedRef.current ? "interrupted" : "listening")
          }
        },
        onInterruption: () => {
          if (!active) return
          interruptedRef.current = true
          setTurn("interrupted")
          window.setTimeout(() => {
            interruptedRef.current = false
          }, 1200)
        },
        onAgentResponseCorrection: (event) => {
          const corrected =
            typeof event === "object" &&
            event !== null &&
            "agent_response_correction_event" in event
              ? String(
                  (event as { agent_response_correction_event?: { corrected_response?: string } })
                    .agent_response_correction_event?.corrected_response ?? "",
                )
              : ""
          if (corrected.trim()) {
            upsertMessage("assistant", corrected, true)
          }
        },
        onStatusChange: ({ status }) => {
          if (active && status === "disconnected") setTurn("idle")
        },
      }

      try {
        const conv = session.conversationToken
          ? await Conversation.startSession({
              ...sessionBase,
              conversationToken: session.conversationToken,
              connectionType: "webrtc",
            })
          : await Conversation.startSession({
              ...sessionBase,
              signedUrl: session.signedUrl!,
              connectionType: "websocket",
            })

        if (!active) {
          await conv.endSession()
          return
        }

        conversationRef.current = conv as VoiceConversation
      } catch (e) {
        if (!active) return
        setTurn("error")
        setError(e instanceof Error ? e.message : "Failed to start voice agent.")
      }
    }

    void connect()

    return () => {
      active = false
      const conv = conversationRef.current
      conversationRef.current = null
      if (conv) void conv.endSession()
    }
  }, [upsertMessage])

  useEffect(() => {
    conversationRef.current?.setMicMuted(micMuted)
  }, [micMuted])

  const turnLabel = {
    connecting: "Connecting voice agent…",
    listening: "Your turn — speak anytime",
    speaking: "Juno is speaking",
    interrupted: "Interrupted — listening",
    idle: "Voice ended",
    error: error ?? "Something went wrong",
  }[turn]

  return (
    <div className="flex flex-1 flex-col">
      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Voice mode uses live turn-taking. You can interrupt Juno mid-sentence, like a call.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={cn(
                "max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-3 border-t border-border px-4 py-4">
        <div
          className={cn(
            "flex h-24 w-24 items-center justify-center rounded-full border-2 transition-all duration-300",
            turn === "speaking" && "border-primary bg-primary/15 scale-105",
            turn === "listening" && "border-primary/50 bg-muted",
            turn === "interrupted" && "border-amber-500/80 bg-amber-500/10",
            turn === "connecting" && "border-border bg-muted/40 animate-pulse",
            turn === "error" && "border-destructive/50 bg-destructive/5",
          )}
        >
          <JunoBlueDotMark className="h-7 w-7" />
        </div>
        <p className="text-center text-xs text-muted-foreground">{turnLabel}</p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border border-border",
              micMuted && "bg-muted text-muted-foreground",
            )}
            aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
            title={micMuted ? "Unmute" : "Mute"}
            disabled={turn === "connecting" || turn === "error"}
            onClick={() => setMicMuted((m) => !m)}
          >
            {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
            aria-label="End voice mode"
            onClick={() => {
              void endSession()
              onClose()
            }}
          >
            <CareerOsIcon name="x" size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

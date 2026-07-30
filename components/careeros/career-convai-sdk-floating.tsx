"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Conversation } from "@elevenlabs/client"
import type { VoiceConversation } from "@elevenlabs/client"
import { Mic, MicOff, Phone, X } from "lucide-react"
import { CareerOsIcon } from "@/components/careeros/icon"
import { JunoBlueDotMark } from "@/components/juno/blue-dot-mark"
import type { CareerConvaiSession } from "@/lib/voice/convai-session"
import {
  registerCareerConvaiSdkStart,
  endCareerConvaiConversation,
} from "@/lib/voice/convai-widget-control"
import { cn } from "@/lib/utils"
import "./career-convai-sdk-floating.css"

type TurnState = "idle" | "connecting" | "listening" | "speaking" | "interrupted" | "error"

type CareerConvaiSdkFloatingProps = {
  session: CareerConvaiSession | null
}

export function CareerConvaiSdkFloating({ session }: CareerConvaiSdkFloatingProps) {
  const [open, setOpen] = useState(false)
  const [turn, setTurn] = useState<TurnState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [micMuted, setMicMuted] = useState(false)
  const [statusLine, setStatusLine] = useState<string | null>(null)

  const conversationRef = useRef<VoiceConversation | null>(null)
  const interruptedRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session

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
    setStatusLine(null)
  }, [])

  const closePanel = useCallback(() => {
    void endSession()
    setOpen(false)
    setError(null)
  }, [endSession])

  const startSession = useCallback(async () => {
    const s = sessionRef.current
    if (!s?.agentId) {
      setError("Voice session not ready. Refresh the page.")
      setTurn("error")
      return
    }

    setOpen(true)
    setError(null)
    setTurn("connecting")
    setStatusLine(null)

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setTurn("error")
      setError("Allow microphone access for usejuno-ai.com, then try again.")
      return
    }

    const dynamicVariables: Record<string, string> = {}
    if (s.careerContextSnippet?.trim()) {
      dynamicVariables.career_context = s.careerContextSnippet.trim()
    }
    if (s.userId) {
      dynamicVariables.user_id = s.userId
    }

    const sessionBase = {
      dynamicVariables,
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
              messages: [{ role: "user", content: question }],
            }),
          })
          const data = (await res.json()) as { text?: string; error?: string }
          if (!res.ok) return data.error ?? "Career brain request failed."
          return data.text?.trim() || "I don't have an answer for that yet."
        },
      },
      onConnect: () => setTurn("listening"),
      onDisconnect: () => {
        setTurn("idle")
        conversationRef.current = null
      },
      onError: (message: string) => {
        setTurn("error")
        setError(message)
      },
      onMessage: ({ message, role }: { message: string; role: string }) => {
        if (role === "user") setStatusLine(`You: ${message.slice(0, 120)}`)
        else setStatusLine(`Juno: ${message.slice(0, 120)}`)
      },
      onModeChange: ({ mode }: { mode: string }) => {
        if (mode === "speaking") setTurn("speaking")
        else if (mode === "listening") {
          setTurn(interruptedRef.current ? "interrupted" : "listening")
        }
      },
      onInterruption: () => {
        interruptedRef.current = true
        setTurn("interrupted")
        window.setTimeout(() => {
          interruptedRef.current = false
        }, 1200)
      },
    }

    try {
      await endSession()

      let conv: VoiceConversation
      if (s.conversationToken) {
        conv = await Conversation.startSession({
          ...sessionBase,
          conversationToken: s.conversationToken,
          connectionType: "webrtc",
        })
      } else if (s.signedUrl) {
        conv = await Conversation.startSession({
          ...sessionBase,
          signedUrl: s.signedUrl,
          connectionType: "websocket",
        })
      } else {
        conv = await Conversation.startSession({
          ...sessionBase,
          agentId: s.agentId,
          connectionType: "webrtc",
        })
      }

      conversationRef.current = conv
    } catch (e) {
      setTurn("error")
      setError(e instanceof Error ? e.message : "Could not start voice agent.")
    }
  }, [endSession])

  useEffect(() => {
    registerCareerConvaiSdkStart(() => {
      if (open && conversationRef.current) return
      void startSession()
    })
    return () => registerCareerConvaiSdkStart(null)
  }, [open, startSession])

  useEffect(() => {
    conversationRef.current?.setMicMuted(micMuted)
  }, [micMuted])

  useEffect(() => {
    return () => {
      registerCareerConvaiSdkStart(null)
      void endSession()
      endCareerConvaiConversation()
    }
  }, [endSession])

  const turnLabel = {
    idle: "Tap to talk with Juno",
    connecting: "Connecting…",
    listening: "Your turn — speak",
    speaking: "Juno is speaking",
    interrupted: "Interrupted — listening",
    error: error ?? "Something went wrong",
  }[turn]

  if (!session?.agentId) return null

  return (
    <div className="career-convai-sdk-root" aria-live="polite">
      {open ? (
        <div className="career-convai-sdk-panel" role="dialog" aria-label="Juno CareerOS voice">
          <div className="career-convai-sdk-panel-header">
            <span className="career-convai-sdk-title">
              <CareerOsIcon name="brain" size={16} /> Juno voice
            </span>
            <button
              type="button"
              className="career-convai-sdk-icon-btn"
              aria-label="Close voice"
              onClick={closePanel}
            >
              <X size={18} />
            </button>
          </div>

          <div className="career-convai-sdk-body">
            <div
              className={cn(
                "career-convai-sdk-orb",
                turn === "speaking" && "is-speaking",
                turn === "listening" && "is-listening",
                turn === "connecting" && "is-connecting",
                turn === "error" && "is-error",
              )}
            >
              <JunoBlueDotMark className="h-8 w-8" />
            </div>
            <p className="career-convai-sdk-status">{turnLabel}</p>
            {statusLine ? (
              <p className="career-convai-sdk-transcript">{statusLine}</p>
            ) : null}
          </div>

          <div className="career-convai-sdk-actions">
            <button
              type="button"
              className={cn("career-convai-sdk-icon-btn", micMuted && "is-muted")}
              aria-label={micMuted ? "Unmute" : "Mute"}
              disabled={turn === "connecting" || turn === "error"}
              onClick={() => setMicMuted((m) => !m)}
            >
              {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              type="button"
              className="career-convai-sdk-end"
              onClick={closePanel}
            >
              End voice
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="career-convai-sdk-fab"
        aria-label={open ? "Voice active" : "Start Juno voice"}
        onClick={() => {
          if (open) closePanel()
          else void startSession()
        }}
      >
        {open ? <X size={22} /> : <Phone size={22} />}
      </button>
    </div>
  )
}

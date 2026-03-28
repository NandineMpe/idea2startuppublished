"use client"

import { useEffect, useRef } from "react"

export type ChatMessage = { role: "user" | "assistant"; content: string }

type Props = {
  messages: ChatMessage[]
  founderName: string
  isJunoSpeaking: boolean
  currentTranscript: string
}

export function ConversationView({
  messages,
  founderName,
  isJunoSpeaking,
  currentTranscript,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isJunoSpeaking, currentTranscript])

  return (
    <div className="space-y-5 pb-28">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
              msg.role === "user"
                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                : "bg-violet-500/15 text-violet-800 dark:text-violet-300"
            }`}
          >
            {msg.role === "user" ? (founderName?.[0]?.toUpperCase() || "Y") : "J"}
          </div>
          <div
            className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-muted text-foreground"
                : "border border-border bg-card text-card-foreground"
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}

      {isJunoSpeaking && (
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-medium text-violet-800 dark:text-violet-300">
            J
          </div>
          <div className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground">
            Thinking…
          </div>
        </div>
      )}

      {currentTranscript && (
        <div className="flex justify-end gap-3">
          <div className="max-w-[75%] rounded-xl bg-muted px-4 py-2.5 text-sm italic text-muted-foreground opacity-80">
            {currentTranscript}
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  )
}

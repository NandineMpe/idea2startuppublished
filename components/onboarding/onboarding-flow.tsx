"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ConversationView, type ChatMessage } from "@/components/onboarding/conversation-view"
import { VoiceInput } from "@/components/onboarding/voice-input"
import { DocumentUpload } from "@/components/onboarding/document-upload"
import { AgentActivation } from "@/components/onboarding/agent-activation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Minimal Web Speech API surface (Chrome / Edge). */
type WebkitSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((ev: SpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type Step = "intro" | "conversation" | "confirming" | "documents" | "activate" | "done"

export function OnboardingFlow() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("intro")
  const [url, setUrl] = useState("")
  const [scrapedData, setScrapedData] = useState<Record<string, unknown> | null>(null)
  const [founderName, setFounderName] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const messagesRef = useRef<ChatMessage[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isJunoSpeaking, setIsJunoSpeaking] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [textInput, setTextInput] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const [isScraping, setIsScraping] = useState(false)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const speechTranscriptRef = useRef("")

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const readSseStream = useCallback(async (res: Response): Promise<string> => {
    const reader = res.body?.getReader()
    if (!reader) return ""
    const decoder = new TextDecoder()
    let out = ""
    let carry = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      carry += decoder.decode(value, { stream: true })
      const lines = carry.split("\n")
      carry = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const payload = line.slice(6).trim()
        if (payload === "[DONE]") continue
        try {
          const parsed = JSON.parse(payload) as { text?: string; error?: string }
          if (parsed.error) console.warn("Stream:", parsed.error)
          if (parsed.text) out += parsed.text
        } catch {
          /* ignore partial JSON */
        }
      }
    }
    if (carry.startsWith("data: ")) {
      const payload = carry.slice(6).trim()
      if (payload !== "[DONE]") {
        try {
          const parsed = JSON.parse(payload) as { text?: string }
          if (parsed.text) out += parsed.text
        } catch {
          /* noop */
        }
      }
    }
    return out
  }, [])

  const sendToJuno = useCallback(
    async (prevMessages: ChatMessage[], scraped: Record<string, unknown> | null) => {
      setIsJunoSpeaking(true)
      try {
        const res = await fetch("/api/onboarding/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: prevMessages,
            scrapedContext: scraped ?? scrapedData,
            founderName,
          }),
        })

        if (!res.ok) {
          console.error("Conversation HTTP error:", res.status)
          return
        }

        const junoResponse = await readSseStream(res)
        let display = junoResponse
        let nextStep: Step | null = null
        if (display.includes("[SUMMARY]")) {
          display = display.replace("[SUMMARY]", "").trim()
          nextStep = "confirming"
        }

        const assistantMsg: ChatMessage = { role: "assistant", content: display }
        const newMessages = [...prevMessages, assistantMsg]
        setMessages(newMessages)
        if (nextStep) setStep(nextStep)
      } catch (e) {
        console.error("Conversation error:", e)
      } finally {
        setIsJunoSpeaking(false)
      }
    },
    [founderName, scrapedData, readSseStream],
  )

  async function handleScrape() {
    if (!url.trim()) return
    setIsScraping(true)
    try {
      const res = await fetch("/api/onboarding/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = (await res.json()) as { scraped?: Record<string, unknown> | null }
      setScrapedData(data.scraped ?? null)
      setStep("conversation")
      await sendToJuno([], data.scraped ?? null)
    } catch {
      setScrapedData(null)
      setStep("conversation")
      await sendToJuno([], null)
    } finally {
      setIsScraping(false)
    }
  }

  function handleSkipScrape() {
    setScrapedData(null)
    setStep("conversation")
    void sendToJuno([], null)
  }

  function startListening() {
    if (typeof window === "undefined") return
    const w = window as unknown as {
      SpeechRecognition?: new () => WebkitSpeechRecognition
      webkitSpeechRecognition?: new () => WebkitSpeechRecognition
    }
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event) => {
      let transcript = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      speechTranscriptRef.current = transcript
      setCurrentTranscript(transcript)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    speechTranscriptRef.current = ""
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setIsListening(false)
    const trimmed = speechTranscriptRef.current.trim()
    speechTranscriptRef.current = ""
    setCurrentTranscript("")
    if (!trimmed || isJunoSpeaking) return

    const prev = messagesRef.current
    const newMessages: ChatMessage[] = [...prev, { role: "user", content: trimmed }]
    setMessages(newMessages)
    void sendToJuno(newMessages, scrapedData)
  }

  function handleTextSubmit() {
    const t = textInput.trim()
    if (!t || isJunoSpeaking) return
    setTextInput("")
    const prev = messagesRef.current
    const newMessages: ChatMessage[] = [...prev, { role: "user", content: t }]
    setMessages(newMessages)
    void sendToJuno(newMessages, scrapedData)
  }

  async function handleComplete() {
    if (!userId) return
    const transcript = messages
      .map((m) => `${m.role === "user" ? "Founder" : "Juno"}: ${m.content}`)
      .join("\n\n")

    const res = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        scrapedData,
        founderName,
      }),
    })
    const data = (await res.json()) as { success?: boolean }
    if (data.success) setStep("documents")
  }

  const hasSpeechAPI =
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
    )

  return (
    <div className="mx-auto max-w-[680px] px-5 py-10">
      {step === "intro" && (
        <div className="pt-[10vh] text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Juno</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Optional: add your website URL for context before the conversation. You can skip and talk only.
          </p>

          <div className="mx-auto mt-8 flex max-w-md flex-col gap-3">
            <Input
              placeholder="Your name"
              value={founderName}
              onChange={(e) => setFounderName(e.target.value)}
            />
            <Input
              type="url"
              placeholder="https://your-company.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScrape()}
            />
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => void handleScrape()} disabled={!url.trim() || isScraping}>
              {isScraping ? "Reading your site…" : "Let’s go"}
            </Button>
            <Button variant="outline" onClick={handleSkipScrape} disabled={isScraping}>
              Skip, just talk
            </Button>
          </div>
        </div>
      )}

      {(step === "conversation" || step === "confirming") && (
        <div>
          <div className="mb-6">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Onboarding
            </p>
            <p className="text-sm text-muted-foreground">
              Speak or type. One assistant message per turn.
            </p>
          </div>

          <ConversationView
            messages={messages}
            founderName={founderName}
            isJunoSpeaking={isJunoSpeaking}
            currentTranscript={currentTranscript}
          />

          {step === "confirming" ? (
            <div className="fixed bottom-0 left-0 right-0 z-10 flex flex-wrap justify-center gap-3 border-t border-border bg-background/95 py-4 backdrop-blur">
              <Button type="button" onClick={() => void handleComplete()}>
                Save and continue
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("conversation")
                  const correction: ChatMessage = {
                    role: "user",
                    content: "Let me correct a few things…",
                  }
                  const newMessages = [...messages, correction]
                  setMessages(newMessages)
                  void sendToJuno(newMessages, scrapedData)
                }}
              >
                Let me correct something
              </Button>
            </div>
          ) : (
            <div className="fixed bottom-0 left-0 right-0 z-10">
              <VoiceInput
                hasSpeechAPI={Boolean(hasSpeechAPI)}
                isListening={isListening}
                isJunoSpeaking={isJunoSpeaking}
                textInput={textInput}
                onTextChange={setTextInput}
                onTextSubmit={handleTextSubmit}
                onMicDown={startListening}
                onMicUp={stopListening}
              />
            </div>
          )}
        </div>
      )}

      {step === "documents" && <DocumentUpload onContinue={() => setStep("activate")} />}

      {step === "activate" && (
        <AgentActivation
          onFinish={() => {
            setStep("done")
            setTimeout(() => router.push("/dashboard"), 2200)
          }}
        />
      )}

      {step === "done" && (
        <div className="pt-[18vh] text-center">
          <h2 className="text-xl font-semibold">Your first daily brief is on its way</h2>
          <p className="mt-2 text-sm text-muted-foreground">Opening your command centre…</p>
        </div>
      )}
    </div>
  )
}

"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ModelSelector, type ModelInfo } from "./model-selector"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Volume2, VolumeX } from "lucide-react"
import type { UIMessage } from "ai"

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

async function speakText(text: string): Promise<void> {
  const res = await fetch('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) return
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.onended = () => URL.revokeObjectURL(url)
  await audio.play()
}

export function ChatWithModels() {
  const [selectedModel, setSelectedModel] = useState<ModelInfo>({
    value: "openai",
    label: "OpenAI GPT-4",
    apiRoute: "/api/chat/openai",
  })
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const spokenIds = useRef<Set<string>>(new Set())

  const transport = useMemo(
    () => new DefaultChatTransport({ api: selectedModel.apiRoute }),
    [selectedModel.apiRoute],
  )

  const { messages, sendMessage, status } = useChat({ transport })
  const [input, setInput] = useState("")
  const isLoading = status === "submitted" || status === "streaming"

  const speakLastAssistant = useCallback(async () => {
    if (!voiceEnabled) return
    const last = [...messages].reverse().find(m => m.role === 'assistant')
    if (!last || spokenIds.current.has(last.id)) return
    const text = getMessageText(last)
    if (!text) return
    spokenIds.current.add(last.id)
    setIsSpeaking(true)
    try {
      await speakText(text)
    } finally {
      setIsSpeaking(false)
    }
  }, [messages, voiceEnabled])

  // Speak new assistant messages once streaming is done
  useEffect(() => {
    if (status === 'ready') {
      void speakLastAssistant()
    }
  }, [status, speakLastAssistant])

  return (
    <Card className="w-full max-w-3xl mx-auto glass-card border-primary/10">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Voice Chat</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setVoiceEnabled(v => !v)}
              title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <div className="w-48">
              <ModelSelector onModelChange={setSelectedModel} />
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[400px] overflow-y-auto space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-3 rounded-lg ${
              message.role === "user" ? "bg-primary/10 ml-auto max-w-[80%]" : "bg-gray-800/50 mr-auto max-w-[80%]"
            }`}
          >
            <p className="text-sm font-medium mb-1">{message.role === "user" ? "You" : selectedModel.label}</p>
            <p className="text-sm whitespace-pre-wrap">{getMessageText(message)}</p>
          </div>
        ))}
        {(isLoading || isSpeaking) && (
          <div className="flex items-center gap-2 justify-center p-4 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            {isSpeaking ? 'Speaking…' : 'Thinking…'}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!input.trim() || isLoading) return
            const t = input.trim()
            setInput("")
            void sendMessage({ text: t })
          }}
          className="w-full flex gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 min-h-[60px] max-h-[120px] bg-black/50 border-gray-800 focus:border-primary"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-primary hover:bg-primary/90 text-black self-end h-[60px]"
          >
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}

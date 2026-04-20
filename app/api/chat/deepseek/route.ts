import { streamText } from "ai"
import { NextResponse } from "next/server"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"

export async function POST(req: Request) {
  let body: unknown
  try {
    const raw = await req.text()
    body = raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }
  const messagesRaw = (body as Record<string, unknown>).messages
  if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) {
    return NextResponse.json({ error: "messages must be a non-empty array" }, { status: 400 })
  }

  const messages: { role: "user" | "assistant"; content: string }[] = []
  for (const m of messagesRaw) {
    if (!m || typeof m !== "object") {
      return NextResponse.json({ error: "Each message must be an object" }, { status: 400 })
    }
    const msg = m as Record<string, unknown>
    if (msg.role !== "user" && msg.role !== "assistant") {
      return NextResponse.json({ error: "Invalid message role" }, { status: 400 })
    }
    if (typeof msg.content !== "string") {
      return NextResponse.json({ error: "Message content must be a string" }, { status: 400 })
    }
    messages.push({ role: msg.role, content: msg.content })
  }

  if (!isLlmConfigured()) {
    return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 503 })
  }

  const result = streamText({
    model: qwenModel(),
    system: mergeSystemWithWritingRules(""),
    messages,
    maxOutputTokens: 2000,
  })

  return result.toUIMessageStreamResponse()
}

import { generateText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { stripCareerChatMarkdown } from "@/lib/careeros/chat-format"
import { getCareerContext } from "@/lib/careeros/career-context"
import { buildCareerChatSystemPrompt } from "@/lib/careeros/career-chat-system-prompt"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE } from "@/lib/llm-provider"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

const MAX_MESSAGES_IN_REQUEST = 40

type ChatMessage = { role: "user" | "assistant"; content: string }

function claudeModel() {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return anthropic("claude-sonnet-4-6")
}

function parseBody(raw: string):
  | { ok: true; messages: ChatMessage[]; sessionId: string | null }
  | { ok: false; error: string } {
  let body: unknown
  try {
    body = raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return { ok: false, error: "Invalid JSON body" }
  }
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" }
  const o = body as Record<string, unknown>
  const messagesRaw = o.messages
  const sessionRaw = o.sessionId

  if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) {
    return { ok: false, error: "messages must be a non-empty array" }
  }

  const messages: ChatMessage[] = []
  for (const m of messagesRaw) {
    if (!m || typeof m !== "object") return { ok: false, error: "Each message must be an object" }
    const msg = m as Record<string, unknown>
    if (msg.role !== "user" && msg.role !== "assistant") {
      return { ok: false, error: "Invalid message role" }
    }
    if (typeof msg.content !== "string") return { ok: false, error: "Message content must be a string" }
    messages.push({ role: msg.role, content: msg.content })
  }

  const last = messages[messages.length - 1]
  if (last.role !== "user" || !last.content.trim()) {
    return { ok: false, error: "Last message must be a non-empty user message" }
  }

  let sessionId: string | null = null
  if (sessionRaw != null && sessionRaw !== "" && typeof sessionRaw === "string") {
    sessionId = sessionRaw.trim() || null
  }

  const trimmed =
    messages.length > MAX_MESSAGES_IN_REQUEST
      ? messages.slice(-MAX_MESSAGES_IN_REQUEST)
      : messages

  return { ok: true, messages: trimmed, sessionId }
}

export async function POST(req: Request) {
  try {
    const raw = await req.text()
    const parsed = parseBody(raw)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { messages, sessionId } = parsed

    if (!process.env.ANTHROPIC_API_KEY && !isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 503 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const lastMessage = messages[messages.length - 1].content

    if (sessionId) {
      const { data: session } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .eq("channel", "careeros")
        .maybeSingle()
      if (!session) {
        return NextResponse.json({ error: "Invalid session" }, { status: 400 })
      }

      void supabase.from("chat_messages").insert({
        session_id: sessionId,
        user_id: user.id,
        role: "user",
        content: lastMessage,
      })
    }

    const careerCtx = await getCareerContext(supabase, user.id)
    const careerBlock = careerCtx.promptBlock.trim()
      ? `# CAREEROS BRAIN (what we know about this user's career)\n${careerCtx.promptBlock}\n\n`
      : "# CAREEROS BRAIN\nNo career data on file yet. Tell them to finish onboarding and open Workspace home.\n\n"

    const promptWithContext = careerBlock + lastMessage

    const systemPrompt = buildCareerChatSystemPrompt()

    const conversationMessages = [
      ...messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: promptWithContext },
    ]

    let text: string
    try {
      const out = await generateText({
        model: claudeModel(),
        system: systemPrompt,
        messages: conversationMessages,
        maxOutputTokens: 3200,
      })
      text = stripCareerChatMarkdown(out.text)
    } catch (e) {
      console.error("[careeros/chat]", e)
      return NextResponse.json(
        { error: "The AI service failed to respond. Try again in a moment." },
        { status: 502 },
      )
    }

    if (sessionId && text) {
      void supabase.from("chat_messages").insert({
        session_id: sessionId,
        user_id: user.id,
        role: "assistant",
        content: text,
      })
      void supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId)
    }

    return NextResponse.json({ text })
  } catch (error: unknown) {
    return jsonApiError(500, error, "careeros/chat POST")
  }
}

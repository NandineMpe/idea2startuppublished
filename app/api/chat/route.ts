import { generateText } from "ai"
import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { getCompanyContext } from "@/lib/company-context"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

const MAX_COMPANY_CONTEXT_CHARS = 12_000
const MAX_MESSAGES_IN_REQUEST = 50

type ChatMessage = { role: "user" | "assistant"; content: string }

function parseChatPostBody(raw: string):
  | { ok: true; messages: ChatMessage[]; sessionId: string | null }
  | { ok: false; error: string } {
  let body: unknown
  try {
    body = raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return { ok: false, error: "Invalid JSON body" }
  }
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid body" }
  }
  const o = body as Record<string, unknown>
  const messagesRaw = o.messages
  const sessionRaw = o.sessionId

  if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) {
    return { ok: false, error: "messages must be a non-empty array" }
  }

  const messages: ChatMessage[] = []
  for (const m of messagesRaw) {
    if (!m || typeof m !== "object") {
      return { ok: false, error: "Each message must be an object" }
    }
    const msg = m as Record<string, unknown>
    if (msg.role !== "user" && msg.role !== "assistant") {
      return { ok: false, error: "Invalid message role" }
    }
    if (typeof msg.content !== "string") {
      return { ok: false, error: "Message content must be a string" }
    }
    if (msg.content.length > 100_000) {
      return { ok: false, error: "Message too long" }
    }
    messages.push({ role: msg.role, content: msg.content })
  }

  const last = messages[messages.length - 1]
  if (last.role !== "user") {
    return { ok: false, error: "Last message must be from the user" }
  }
  if (!last.content.trim()) {
    return { ok: false, error: "Last message cannot be empty" }
  }

  let sessionId: string | null = null
  if (sessionRaw != null && sessionRaw !== "") {
    if (typeof sessionRaw !== "string") {
      return { ok: false, error: "sessionId must be a string" }
    }
    const t = sessionRaw.trim()
    sessionId = t || null
  }

  const trimmed =
    messages.length > MAX_MESSAGES_IN_REQUEST ? messages.slice(-MAX_MESSAGES_IN_REQUEST) : messages

  return { ok: true, messages: trimmed, sessionId }
}

export async function POST(req: Request) {
  try {
    const raw = await req.text()
    const parsed = parseChatPostBody(raw)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { messages, sessionId } = parsed

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 503 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const userId = user?.id
    const lastMessage = messages[messages.length - 1].content

    if (userId && sessionId) {
      supabase
        .from("chat_messages")
        .insert({ session_id: sessionId, user_id: userId, role: "user", content: lastMessage })
        .then(({ error }) => {
          if (error) console.error("Failed to save user message:", error.message)
        })
    }

    const companyCtx = await getCompanyContext(userId, {
      queryHint: lastMessage.slice(0, 500) || "company strategy product market",
      refreshVault: "if_stale",
    })

    let companyBlockRaw = companyCtx?.promptBlock?.trim() ?? ""
    if (companyBlockRaw.length > MAX_COMPANY_CONTEXT_CHARS) {
      companyBlockRaw = `${companyBlockRaw.slice(0, MAX_COMPANY_CONTEXT_CHARS)}\n\n[Company context truncated for chat length.]`
    }
    const companyBlock = companyBlockRaw
      ? `# COMPANY CONTEXT (what we know about this startup)\n${companyBlockRaw}\n\n`
      : ""

    const promptWithContext = companyBlock + lastMessage

    const systemPrompt =
      "You are Juno, a sharp, direct startup sidekick. You help founders think critically about their ideas, strategy, and execution. You're not a cheerleader - you challenge assumptions and push for clarity. Be concise, insightful, and actionable. Answer the user's question even if it is not about startups (brief and practical). When company context is provided, use it; when it is not, still help."

    const conversationMessages = [
      ...messages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user" as const, content: promptWithContext },
    ]

    let text: string
    try {
      const out = await generateText({
        model: qwenModel(),
        system: mergeSystemWithWritingRules(systemPrompt),
        messages: conversationMessages,
        maxOutputTokens: 1500,
      })
      text = out.text
    } catch (e) {
      console.error("[chat POST] generateText failed:", e)
      return NextResponse.json(
        { error: "The AI service failed to respond. Try again in a moment." },
        { status: 502 },
      )
    }

    if (userId && sessionId && text) {
      supabase
        .from("chat_messages")
        .insert({ session_id: sessionId, user_id: userId, role: "assistant", content: text })
        .then(({ error }) => {
          if (error) console.error("Failed to save assistant message:", error.message)
        })

      supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .then(() => {})
    }

    return NextResponse.json({ text })
  } catch (error: unknown) {
    return jsonApiError(500, error, "chat POST")
  }
}

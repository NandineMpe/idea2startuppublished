import { generateText } from "ai"
import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { getCompanyContext } from "@/lib/company-context"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const { messages, sessionId } = await req.json()

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const userId = user?.id
    const lastMessage = messages[messages.length - 1]?.content ?? ""

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
      refreshVault: "always",
    })
    const companyBlock =
      companyCtx?.promptBlock?.trim()
        ? `# COMPANY CONTEXT (what we know about this startup)\n${companyCtx.promptBlock}\n\n`
        : ""

    const promptWithContext = companyBlock + lastMessage

    const systemPrompt =
      "You are Juno, a sharp, direct startup sidekick. You help founders think critically about their ideas, strategy, and execution. You're not a cheerleader - you challenge assumptions and push for clarity. Be concise, insightful, and actionable."

    const conversationMessages = [
      ...messages.slice(0, -1).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: promptWithContext },
    ]

    const { text } = await generateText({
      model: qwenModel(),
      system: mergeSystemWithWritingRules(systemPrompt),
      messages: conversationMessages,
      maxTokens: 1000,
    })

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

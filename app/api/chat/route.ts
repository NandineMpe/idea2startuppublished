import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { addToMemory, queryMemory } from "@/lib/supermemory"

export async function POST(req: Request) {
  try {
    const { messages, sessionId } = await req.json()

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 })
    }

    // Resolve authenticated user (optional — works without auth too)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const userId = user?.id
    const lastMessage = messages[messages.length - 1]?.content ?? ""

    // Retrieve per-user semantic context from Supermemory
    let context = ""
    try {
      const memories = await queryMemory(lastMessage, userId)
      if (memories?.length > 0) {
        context = memories.map((m: { content?: string }) => m.content ?? "").join("\n---\n")
      }
    } catch {
      // Non-fatal — continue without context
    }

    // Fire-and-forget: save user message to Supermemory
    if (lastMessage) {
      addToMemory(lastMessage, userId).catch(() => {})
    }

    // Persist user message to Supabase chat_messages (if user is logged in and has a session)
    if (userId && sessionId) {
      supabase
        .from("chat_messages")
        .insert({ session_id: sessionId, user_id: userId, role: "user", content: lastMessage })
        .then(({ error }) => {
          if (error) console.error("Failed to save user message:", error.message)
        })
    }

    const promptWithContext = context
      ? `Context from previous conversations:\n${context}\n\nUser Question: ${lastMessage}`
      : lastMessage

    const systemPrompt = `You are Juno, a sharp, direct startup sidekick. You help founders think critically about their ideas, strategy, and execution. You're not a cheerleader — you challenge assumptions and push for clarity. Be concise, insightful, and actionable.`

    const conversationMessages = [
      ...messages.slice(0, -1).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: promptWithContext },
    ]

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: conversationMessages,
      maxTokens: 1000,
    })

    // Persist assistant response to Supabase
    if (userId && sessionId && text) {
      supabase
        .from("chat_messages")
        .insert({ session_id: sessionId, user_id: userId, role: "assistant", content: text })
        .then(({ error }) => {
          if (error) console.error("Failed to save assistant message:", error.message)
        })

      // Update session's updated_at so it bubbles to top of history
      supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .then(() => {})
    }

    return NextResponse.json({ text })
  } catch (error: unknown) {
    console.error("Chat error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

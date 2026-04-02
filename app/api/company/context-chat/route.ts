import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { logApiError, safeErrorMessageForClient } from "@/lib/api-error-response"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { getCompanyContext } from "@/lib/company-context"
import { createClient } from "@/lib/supabase/server"

const anthropic = new Anthropic()

export function buildContextUpdatePrompt(
  founderName: string,
  companyContext: string,
  brainSummary: string,
): string {
  const serverContext =
    companyContext.trim() || "No server-side company context loaded yet."
  const pageSummaryBlock = brainSummary.trim()
    ? `\n\nThe context page also handed you this summary. Treat it as supporting context, but prefer the server-side company context above if they conflict:\n\n${brainSummary}`
    : ""

  return `You are Juno, the founder's AI executive team. They opened "Update context" to tell you what changed about their company — pivot, traction, competitors, funding, risks, or priorities.

You already have this server-side company context in mind (company profile, saved knowledge base, synced vault cache, and saved documents):

${serverContext}${pageSummaryBlock}

RULES:
- Be concise: 2–3 sentences per reply unless they ask for detail.
- Ask ONE follow-up at a time. Never stack multiple questions.
- Sound like a sharp colleague, not a form. No sycophancy.
- If they mention something material, briefly acknowledge and ask one clarifying question if needed.
- Do not dump long lists. If they want to paste a lot of text, that's fine — absorb it and respond briefly.
- You are not rewriting their profile here; you're having a conversation. They can also edit cards on the page.

The founder's name is ${founderName || "the founder"}.`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    messages?: Array<{ role: string; content: string }>
    founderName?: string
    brainSummary?: string
    sessionId?: string
  }

  const messages = Array.isArray(body.messages) ? body.messages : []
  const clientFounderName = typeof body.founderName === "string" ? body.founderName : ""
  const brainSummary =
    typeof body.brainSummary === "string" && body.brainSummary.trim()
      ? body.brainSummary.slice(0, 12000)
      : ""
  const companyCtx = await getCompanyContext(user.id, { refreshVault: "always" }).catch(() => null)
  const founderName = companyCtx?.profile.founder_name?.trim() || clientFounderName

  const bootstrap =
    messages.length === 0
      ? [{ role: "user" as const, content: "I'm ready — I want to update you on what changed." }]
      : messages

  const systemPrompt = buildContextUpdatePrompt(founderName, companyCtx?.promptBlock ?? "", brainSummary)

  let activeSessionId = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : null
  const lastUser = [...bootstrap].reverse().find((m) => m.role === "user")

  if (!activeSessionId && lastUser?.content) {
    const title = lastUser.content.trim().slice(0, 80) || "Context update"
    const { data: row, error: insErr } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        title,
        channel: "context",
      })
      .select("id")
      .single()
    if (!insErr && row?.id) activeSessionId = row.id
  }

  if (activeSessionId && lastUser?.content) {
    const { error: msgErr } = await supabase.from("chat_messages").insert({
      session_id: activeSessionId,
      user_id: user.id,
      role: "user",
      content: lastUser.content,
    })
    if (msgErr) console.error("[context-chat] user message insert:", msgErr.message)
  }

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    system: mergeSystemWithWritingRules(systemPrompt),
    messages: bootstrap.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let assistantText = ""
      try {
        if (activeSessionId) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ sessionId: activeSessionId })}\n\n`),
          )
        }
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta" &&
            "text" in event.delta
          ) {
            const text = event.delta.text
            assistantText += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
        }
        if (activeSessionId && assistantText.trim()) {
          await supabase.from("chat_messages").insert({
            session_id: activeSessionId,
            user_id: user.id,
            role: "assistant",
            content: assistantText,
          })
          await supabase
            .from("chat_sessions")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", activeSessionId)
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      } catch (e) {
        logApiError("context-chat stream", e)
        const msg = safeErrorMessageForClient(e, "Stream error")
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

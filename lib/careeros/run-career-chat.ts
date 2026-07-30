import { generateText, streamText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { SupabaseClient } from "@supabase/supabase-js"
import { stripCareerChatMarkdown } from "@/lib/careeros/chat-format"
import { buildCareerChatSystemPrompt } from "@/lib/careeros/career-chat-system-prompt"
import { getCareerContext } from "@/lib/careeros/career-context"

export { CAREEROS_ELEVENLABS_AGENT_PROMPT } from "@/lib/careeros/careeros-elevenlabs-voice-prompt"

export type CareerChatMessage = { role: "user" | "assistant" | "system"; content: string }

function claudeModel() {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return anthropic("claude-sonnet-4-6")
}

function formatCareerBrainBlock(promptBlock: string): string {
  const trimmed = promptBlock.trim()
  return trimmed
    ? `# CAREEROS BRAIN (live from Juno app)\n${trimmed}`
    : "# CAREEROS BRAIN\nNo career data on file yet. Tell them to finish onboarding in Workspace and open Skills."
}

/** OpenAI-style messages from ElevenLabs custom LLM or our chat API. */
export function normalizeCareerLlmMessages(
  raw: CareerChatMessage[],
  options?: { injectedCareerBlock?: string },
): { system: string; conversation: { role: "user" | "assistant"; content: string }[] } {
  const systemParts: string[] = []
  const conversation: { role: "user" | "assistant"; content: string }[] = []

  for (const m of raw) {
    if (!m?.content?.trim()) continue
    if (m.role === "system") {
      systemParts.push(m.content.trim())
      continue
    }
    if (m.role === "user" || m.role === "assistant") {
      conversation.push({ role: m.role, content: m.content })
    }
  }

  const base = buildCareerChatSystemPrompt()
  const voice = systemParts.length ? `\n\n# Voice agent instructions\n${systemParts.join("\n\n")}` : ""
  const brain = options?.injectedCareerBlock
    ? `\n\n${formatCareerBrainBlock(options.injectedCareerBlock)}`
    : ""
  return { system: base + voice + brain, conversation }
}

export function parseElevenLabsUserId(body: Record<string, unknown>): string | null {
  const top = body.user_id
  if (typeof top === "string" && top.trim()) return top.trim()
  const extra = body.elevenlabs_extra_body
  if (!extra || typeof extra !== "object") return null
  const uid = (extra as Record<string, unknown>).user_id
  return typeof uid === "string" && uid.trim() ? uid.trim() : null
}

export async function runCareerChatTurn(
  supabase: SupabaseClient,
  userId: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const last = messages[messages.length - 1]
  if (!last || last.role !== "user" || !last.content.trim()) {
    throw new Error("Last message must be a non-empty user message")
  }

  const careerCtx = await getCareerContext(supabase, userId)
  const promptWithContext = `${formatCareerBrainBlock(careerCtx.promptBlock)}\n\n${last.content}`
  const conversationMessages = [
    ...messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: promptWithContext },
  ]

  const out = await generateText({
    model: claudeModel(),
    system: buildCareerChatSystemPrompt(),
    messages: conversationMessages,
    maxOutputTokens: 3200,
  })

  return stripCareerChatMarkdown(out.text)
}

/** SSE stream in OpenAI chat.completion.chunk format for ElevenLabs custom LLM. */
function systemAlreadyHasCareerBlock(systemParts: string[]): boolean {
  const joined = systemParts.join("\n")
  return (
    joined.includes("## Career profile") ||
    joined.includes("CAREEROS BRAIN") ||
    joined.includes("{{career_context}}")
  )
}

export async function streamCareerChatForCustomLlm(
  supabase: SupabaseClient,
  messages: CareerChatMessage[],
  options?: { userId?: string | null },
) {
  const systemParts: string[] = []
  for (const m of messages) {
    if (m.role === "system" && m.content?.trim()) systemParts.push(m.content.trim())
  }

  let injectedCareerBlock: string | undefined
  const userId = options?.userId?.trim()
  if (userId && !systemAlreadyHasCareerBlock(systemParts)) {
    try {
      const careerCtx = await getCareerContext(supabase, userId)
      injectedCareerBlock = careerCtx.promptBlock
    } catch (e) {
      console.error("[careeros/voice/llm] context load", e)
    }
  }

  const { system, conversation } = normalizeCareerLlmMessages(messages, {
    injectedCareerBlock,
  })
  if (conversation.length === 0 || conversation[conversation.length - 1].role !== "user") {
    throw new Error("Last message must be a user message")
  }

  const result = streamText({
    model: claudeModel(),
    system,
    messages: conversation,
    maxOutputTokens: 3200,
  })

  const encoder = new TextEncoder()
  const created = Math.floor(Date.now() / 1000)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of result.textStream) {
          const chunk = {
            id: `chatcmpl-careeros-${created}`,
            object: "chat.completion.chunk",
            created,
            model: "careeros-juno",
            choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        }
        const done = {
          id: `chatcmpl-careeros-${created}`,
          object: "chat.completion.chunk",
          created,
          model: "careeros-juno",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(done)}\n\n`))
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      } catch (e) {
        const msg = e instanceof Error ? e.message : "stream error"
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: { message: msg } })}\n\n`),
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}


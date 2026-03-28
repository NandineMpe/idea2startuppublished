import { anthropic } from "@ai-sdk/anthropic"
import { streamText } from "ai"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"

export async function POST(req: Request) {
  const { messages } = await req.json()

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY environment variable" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: mergeSystemWithWritingRules(""),
    messages: messages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    maxTokens: 2000,
  })

  return result.toDataStreamResponse()
}

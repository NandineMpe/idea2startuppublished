import { streamText } from "ai"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"

export async function POST(req: Request) {
  const { messages } = await req.json()

  if (!isLlmConfigured()) {
    return new Response(JSON.stringify({ error: LLM_API_KEY_MISSING_MESSAGE }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const result = streamText({
    model: qwenModel(),
    system: mergeSystemWithWritingRules(""),
    messages: messages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    maxTokens: 2000,
  })

  return result.toDataStreamResponse()
}

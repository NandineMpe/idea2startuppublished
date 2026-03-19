import { anthropic } from "@ai-sdk/anthropic"
import { streamText } from "ai"
import { addToMemory, queryMemory } from "@/lib/supermemory"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    const lastMessage = messages[messages.length - 1].content

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    let context = ""
    try {
      const memories = await queryMemory(lastMessage)
      if (memories && memories.length > 0) {
        context = memories.map((m: any) => m.content).join("\n---\n")
      }
    } catch {
      // Continue without context
    }

    addToMemory(lastMessage).catch(() => {})

    let promptWithContext = lastMessage
    if (context) {
      promptWithContext = `Context from previous conversations/memories:\n${context}\n\nUser Question: ${lastMessage}`
    }

    const systemPrompt = `You are Juno, a sharp, direct startup sidekick. You help founders think critically about their ideas, strategy, and execution. You're not a cheerleader — you challenge assumptions and push for clarity. Be concise, insightful, and actionable.`

    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: [
        ...messages.slice(0, -1).map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: promptWithContext },
      ],
      maxTokens: 1000,
    })

    return result.toDataStreamResponse()
  } catch (error: any) {
    console.error("Chat error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

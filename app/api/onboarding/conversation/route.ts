import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { logApiError, safeErrorMessageForClient } from "@/lib/api-error-response"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { createClient } from "@/lib/supabase/server"

const anthropic = new Anthropic()

export function buildOnboardingSystemPrompt(scrapedContext: unknown, founderName: string): string {
  const ctx =
    scrapedContext && typeof scrapedContext === "object"
      ? JSON.stringify(scrapedContext, null, 2)
      : scrapedContext
        ? String(scrapedContext)
        : ""

  return `You are Juno, an AI executive team being onboarded by a startup founder.
This is your FIRST conversation with ${founderName || "the founder"}. Your goal is to deeply
understand their company, their thinking, and what matters to them.

${ctx ? `WHAT YOU ALREADY KNOW (from scraping their website):
${ctx}

Use this to ask INFORMED questions — don't ask things you already know.
Reference specifics from their website to show you've done your homework.` : "You don't have any pre-scraped data. Start by asking about their company."}

CONVERSATION STRUCTURE (follow this arc):

Turn 1: Open with what you know. Ask about the PROBLEM they're solving and WHY.
"I've looked at [company] — [what you understand]. What's the problem you saw?"

Turn 2-3: Go deeper on ICP and market.
"Who specifically is your customer? The person who signs the contract — what's their title, company size?"
"How do they solve this problem today without you?"

Turn 4: Competitors and differentiation.
"Who else is trying to solve this? What do you do that they can't?"

Turn 5: Current state and traction.
"Where are you right now? Revenue, users, conversations happening?"

Turn 6: Priorities and roadmap.
"What's your focus for the next 90 days? The three things that matter most."

Turn 7: Risks and worries.
"What keeps you up at night? The thing that could go wrong."

Turn 8: Summary and confirmation.
Reflect back everything in 60 seconds. "Here's what I understand... Did I get that right?"

RULES:
- Ask ONE question at a time. Never stack multiple questions.
- Keep responses to 2-3 sentences max. The founder should talk more than you.
- Reference specifics from their previous answers. Show you're listening.
- If they give a vague answer, push for specifics: "Can you give me an example?"
- Use their name naturally.
- Sound like a smart colleague, not a survey.
- Don't be sycophantic. Don't say "that's a great answer."
- When you reach turn 8, start your message with [SUMMARY] so the UI knows to show the confirmation step.`
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
    scrapedContext?: unknown
    founderName?: string
  }

  const messages = Array.isArray(body.messages) ? body.messages : []
  const scrapedContext = body.scrapedContext
  const founderName = typeof body.founderName === "string" ? body.founderName : ""

  const bootstrap =
    messages.length === 0
      ? [{ role: "user" as const, content: "I'm ready to begin. Please open our onboarding conversation." }]
      : messages

  const systemPrompt = buildOnboardingSystemPrompt(scrapedContext, founderName)

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
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta" &&
            "text" in event.delta
          ) {
            const text = event.delta.text
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
            )
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      } catch (e) {
        logApiError("onboarding conversation stream", e)
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

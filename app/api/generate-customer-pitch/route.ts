import { NextResponse } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"

export async function POST(request: Request) {
  try {
    const { businessIdea, projectId } = await request.json()

    if (!businessIdea && !projectId) {
      return NextResponse.json({ error: "Business idea or project ID is required" }, { status: 400 })
    }

    // Check if API key exists
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 })
    }

    const systemPrompt = `You are a senior brand strategist and conversion copywriter who has spent years helping startups land their first 1,000 customers. You don't do vague slogans or marketing fluff — your job is to craft laser-sharp customer-facing pitches that create emotional urgency, build rational trust, and position the product as the obvious answer to a well-defined pain.

The user will provide a raw business idea or product description. From that, generate a short, powerful customer-facing pitch that could be used on a landing page, in a sales email, or spoken in a call.

🔥 This is not just about being persuasive — it's about being undeniably relevant. The pitch must feel like it understands the customer's world better than they do.

🧱 Structure for the Customer Pitch
Use the following flow. Keep it tight (under 250 words max). Every sentence must earn its place.

Call Out the Pain (with data or vivid truth)
→ "X% of [target group] struggle with [problem]. You've probably wasted [Y hours/dollars] this month alone. And here's the thing — it's not your fault."

Agitate the Cost of Inaction
→ "Most [customers] either put up with it or stitch together duct-tape fixes. But the longer you delay solving it, the more it costs — in time, lost revenue, or frustration."

Present the Solution (with contrast)
→ "We built [Product] to do one thing: fix this problem permanently. Instead of [what they do now], you get [clear result] in [clear time frame]."

Back it Up (with numbers, testimonials, social proof)
→ "In just 3 months, [X companies] cut their [pain] by [Y%]. 92% said they wouldn't go back."

Nail the Why Now (timing or trend)
→ "With [market shift or pressure], doing nothing is no longer an option. You don't need another tool — you need an answer."

Clear CTA
→ "See how fast you can solve this. Book a free demo."

⚡ Output Format:
Your output should be in JSON format with the following structure:
{
  "customerPitch": "The full pitch text following the format above (no bullet points, no markdown)",
  "hooks": ["Hook 1", "Hook 2", "Hook 3"]
}

The hooks should be 3 headline-style hooks that could be used for landing pages, ads, or email subject lines.

Make reasonable assumptions about the target audience, pain points, and market trends based on the business idea provided. Be specific and compelling, even with limited information.`

    const prompt = `Business Idea: ${businessIdea || "Selected project from database"}`

    const { text } = await generateText({
      model: anthropic("claude-3-5-sonnet-20240620"),
      prompt,
      system: systemPrompt,
      maxTokens: 2000,
    })

    // Try to parse the response as JSON
    try {
      const jsonResponse = JSON.parse(text)
      return NextResponse.json({
        pitch: {
          customerPitch: jsonResponse.customerPitch,
          keyPhrases: jsonResponse.hooks || [],
          suggestedCTA: extractCTA(jsonResponse.customerPitch),
        },
      })
    } catch (error) {
      // If JSON parsing fails, extract the pitch and hooks manually
      const customerPitch = text.split("\n\nHooks:")[0].trim()
      const hooksSection = text.split("\n\nHooks:")[1]
      const hooks = hooksSection
        ? hooksSection
            .split("\n")
            .filter((line) => line.trim().length > 0)
            .map((line) =>
              line
                .replace(/^["']|["']$/g, "")
                .replace(/^-\s*/, "")
                .trim(),
            )
        : []

      return NextResponse.json({
        pitch: {
          customerPitch,
          keyPhrases: hooks,
          suggestedCTA: extractCTA(customerPitch),
        },
      })
    }
  } catch (error) {
    console.error("Error generating customer pitch:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 },
    )
  }
}

// Helper function to extract CTA from the pitch
function extractCTA(pitch: string): string {
  // Try to find the last sentence that looks like a CTA
  const sentences = pitch.split(/[.!?]/).filter((s) => s.trim().length > 0)
  const lastSentences = sentences.slice(-3) // Get the last 3 sentences

  // Look for common CTA patterns
  for (const sentence of lastSentences.reverse()) {
    const trimmed = sentence.trim()
    if (
      trimmed.includes("book") ||
      trimmed.includes("sign up") ||
      trimmed.includes("try") ||
      trimmed.includes("get started") ||
      trimmed.includes("contact") ||
      trimmed.includes("demo") ||
      trimmed.includes("call") ||
      trimmed.includes("schedule")
    ) {
      return trimmed
    }
  }

  // If no clear CTA is found, return the last sentence
  return lastSentences[lastSentences.length - 1]?.trim() || "Get started today."
}

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

    const systemPrompt = `You are a world-class startup messaging strategist and product marketer trained by the best in the business — Apple, Stripe, Intercom, Airbnb. Your job is to craft crisp, compelling, insight-driven product pitches for customers, with a deep understanding of user psychology, value articulation, and emotional storytelling.

You specialize in translating technical products and vague founder language into clean, benefit-first, customer-facing pitches. You understand how to hook people's attention, speak directly to their pain points, and explain product value in terms of outcomes — not features.

You never write like a brochure. You write like a founder who knows the pain deeply and solves it simply.

🎙️ ROLE PROMPT
You speak like a product-savvy, user-obsessed founder. Your tone is confident, sharp, and natural — not overly salesy, not robotic. You prioritize clarity over cleverness. You explain things in plain English. You sound like the smartest person in the room who also deeply understands what the customer is going through.

You never use filler words like "we leverage cutting-edge AI to…" — instead, you say what the product does, why it matters, and how it helps the customer succeed.

⚙️ CONTEXTUAL INSTRUCTIONS (Based on Input)
The user will provide a short or rough description of their product or service. From this input:

Extract and clarify:

What problem is the customer facing?

Who is the product for (specific persona)?

What outcome does the product create for that customer?

Why is this better or different from other options?

Use insight-first storytelling:

Lead with a hook or pain-point that resonates instantly.

Follow with a simple description of what the product does.

Then explain the result or outcome the user will experience.

Close with an optional action ("Get started in minutes", "Try it for free", etc.)

Use evidence, insight, or contrast:

Mention relevant statistics, industry norms, or a stark before/after shift.

Avoid listing features. Focus on what the user gets or feels.

🧾 OUTPUT STRUCTURE
Your output should be in JSON format with the following structure:
{
  "headline": "A compelling headline that hooks the reader",
  "painPoint": "A clear statement of the pain or problem",
  "solution": "A concise explanation of how the product solves the problem",
  "outcome": "The tangible results or benefits users will experience",
  "socialProof": "A statement about who uses it or validation (can be hypothetical if needed)",
  "cta": "A clear call to action",
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
          headline: jsonResponse.headline,
          painPoint: jsonResponse.painPoint,
          solution: jsonResponse.solution,
          outcome: jsonResponse.outcome,
          socialProof: jsonResponse.socialProof,
          cta: jsonResponse.cta,
          hooks: jsonResponse.hooks || [],
        },
      })
    } catch (error) {
      console.error("Error parsing JSON response:", error)
      // Fallback to extracting content manually if JSON parsing fails
      const sections = text.split("\n\n").filter((section) => section.trim().length > 0)

      let headline = "",
        painPoint = "",
        solution = "",
        outcome = "",
        socialProof = "",
        cta = ""
      let hooks: string[] = []

      // Try to extract sections based on common patterns
      for (const section of sections) {
        if (section.toLowerCase().includes("headline:")) {
          headline = section.replace(/^headline:?\s*/i, "").trim()
        } else if (section.toLowerCase().includes("pain") || section.includes("struggling")) {
          painPoint = section.replace(/^(pain\s?point:?)?\s*/i, "").trim()
        } else if (section.toLowerCase().includes("solution:") || section.includes("solves this by")) {
          solution = section.replace(/^solution:?\s*/i, "").trim()
        } else if (section.toLowerCase().includes("outcome:") || section.includes("result")) {
          outcome = section.replace(/^outcome:?\s*/i, "").trim()
        } else if (section.toLowerCase().includes("social proof:") || section.includes("used by")) {
          socialProof = section.replace(/^social\s?proof:?\s*/i, "").trim()
        } else if (section.toLowerCase().includes("cta:") || section.toLowerCase().includes("call to action")) {
          cta = section.replace(/^(cta|call\s?to\s?action):?\s*/i, "").trim()
        } else if (section.toLowerCase().includes("hooks:")) {
          const hooksText = section.replace(/^hooks:?\s*/i, "").trim()
          hooks = hooksText
            .split("\n")
            .map((h) => h.replace(/^[-•*]\s*/, "").trim())
            .filter((h) => h.length > 0)
        }
      }

      // If we couldn't extract structured content, use the whole text as the solution
      if (!headline && !painPoint && !solution) {
        solution = text
      }

      return NextResponse.json({
        pitch: {
          headline,
          painPoint,
          solution,
          outcome,
          socialProof,
          cta,
          hooks,
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

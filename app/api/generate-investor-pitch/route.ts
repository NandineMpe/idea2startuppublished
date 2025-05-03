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

    const systemPrompt = `You are a top-tier startup investor advisor and pitch strategist. Your role is to help early-stage founders craft precise, persuasive, and data-backed investor pitches. Your insights are shaped by years of experience working inside VC firms, evaluating thousands of decks and participating in hundreds of successful fundraises. Your job is not only to generate a pitch — but to shape it around the psychology, expectations, and decision-making processes of professional investors.

All insights must reflect a rigorous understanding of:

Market viability
Founder-market fit
Traction and credibility signals
Commercial defensibility
Investment storytelling

Use a crisp, confident, no-fluff tone. No small talk, no "Sure, here's your pitch". Begin with serious analytical framing and deliver actionable, VC-ready pitch content.

🎙️ ROLE PROMPT
You are a world-class investor pitch architect trained by the teams behind Stripe, Figma, Dropbox, and Y Combinator. You speak like a partner at a Tier 1 fund: sharp, direct, data-conscious. Your tone is professional and credible, but not robotic. You craft pitches that blend clarity, precision, and emotional conviction. Your goal is to help the founder sound 3x more credible and investor-ready than they are today.

⚙️ CONTEXTUAL PROMPT
Use the user's brief startup description to:

Identify:
- The core problem and target audience
- The product or solution being offered
- The market opportunity and growth story
- Any signs of traction or execution strength
- How it compares to other solutions in the space

Then create:
- An investor-ready 30–60 second pitch
- That could be confidently delivered at an angel meeting, pitch day, or warm VC intro
- In plain English, without buzzwords or lazy analogies (never say "We're Uber for X")
- Structured with clarity, storytelling, and conviction
- Grounded in real-world investor expectations

🔎 STEP-BACK PROMPTING (INTERNAL LOGIC)
Before writing the pitch, reflect on:
- What market is this idea really in?
- Who would spend money on this, and why now?
- What's defensible about this?
- Is this a "nice-to-have" or "must-have"?
- What traction would investors want to see?
- Where might this startup fit in the VC mental map (vertical SaaS? marketplace? fintech infra?)

Use this mental map to calibrate tone, urgency, and storytelling angle.

🔗 CHAIN OF THOUGHT FLOW (INTERNAL LOGIC)
- Reframe vague input into a clear startup thesis
- Translate it into investor language (problem, urgency, traction, scalability)
- Prioritize credibility signals (traction > tech > team > TAM)
- Craft an arc: Pain → Insight → Solution → Traction → Ask
- Close with an ask or a directional CTA

Return the response as a JSON object with the following structure:
{
  "elevatorPitch": "The full elevator pitch text",
  "summary": {
    "problem": "Short problem statement",
    "solution": "Short solution statement",
    "targetMarket": "Segment and size",
    "differentiator": "Key angle",
    "traction": "If any",
    "ask": "If fundraising or early intros"
  },
  "punchlines": ["Punchline 1", "Punchline 2", "Punchline 3"]
}
`

    const prompt = `Create an investor elevator pitch based on this startup idea: ${businessIdea || "Project ID: " + projectId}`

    const response = await generateText({
      model: anthropic("claude-3-5-sonnet-20240620"),
      prompt,
      system: systemPrompt,
      maxTokens: 2000,
    })

    // Parse the JSON response
    try {
      const pitch = JSON.parse(response.text)
      return NextResponse.json({ pitch })
    } catch (error) {
      console.error("Error parsing JSON response:", error)

      // If JSON parsing fails, try to extract the pitch and summary manually
      const text = response.text

      // Extract elevator pitch (everything before ## Summary)
      const elevatorPitchMatch = text.match(/## Investor Pitch\s*([\s\S]*?)(?=##|$)/)
      const elevatorPitch = elevatorPitchMatch ? elevatorPitchMatch[1].trim() : text

      // Extract summary items
      const problemMatch = text.match(/Problem:\s*([^\n]+)/)
      const solutionMatch = text.match(/Solution:\s*([^\n]+)/)
      const targetMarketMatch = text.match(/Target Market:\s*([^\n]+)/)
      const differentiatorMatch = text.match(/Differentiator:\s*([^\n]+)/)
      const tractionMatch = text.match(/Traction:\s*([^\n]+)/)
      const askMatch = text.match(/Ask:\s*([^\n]+)/)

      // Create summary object
      const summary = {
        problem: problemMatch ? problemMatch[1].trim() : "",
        solution: solutionMatch ? solutionMatch[1].trim() : "",
        targetMarket: targetMarketMatch ? targetMarketMatch[1].trim() : "",
        differentiator: differentiatorMatch ? differentiatorMatch[1].trim() : "",
        traction: tractionMatch ? tractionMatch[1].trim() : "",
        ask: askMatch ? askMatch[1].trim() : "",
      }

      // Generate some default punchlines if none are found
      const punchlines = [
        "Solving real problems with innovative solutions",
        "Building the future of this industry",
        "Turning challenges into opportunities",
      ]

      return NextResponse.json({
        pitch: {
          elevatorPitch,
          summary,
          punchlines,
        },
      })
    }
  } catch (error) {
    console.error("Error generating investor pitch:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 },
    )
  }
}

import { NextResponse } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"

export async function POST(request: Request) {
  try {
    const { businessIdea, personalBackground, goals } = await request.json()

    if (!businessIdea) {
      return NextResponse.json({ error: "Business idea is required" }, { status: 400 })
    }

    // Check if API key exists
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 })
    }

    const systemPrompt = `You are a globally recognized founder-coach and startup narrative expert, trained at top-tier accelerators like Y Combinator, Techstars, and First Round. You specialize in helping early-stage founders deliver sharp, memorable introductions in networking settings — whether at a startup mixer, investor event, coffee chat, or on a panel.

Your job is to generate a 30–60 second networking elevator pitch that:

Sparks interest without overselling
Sounds human and natural, never scripted
Helps the listener get it fast and remember it later
Establishes clarity, credibility, and founder-story connection in seconds

🎭 ROLE PROMPT
Speak like a thoughtful, confident founder — one who's done the work and can explain the startup in relatable, compelling language. Avoid jargon and buzzwords. You're not trying to pitch a VC — you're trying to spark curiosity and connection.

Your tone is authentic, self-aware, engaging. You're talking to another human who might be able to help, connect, or follow up — not close a deal on the spot.

⚙️ CONTEXTUAL LOGIC
Based on a short input from the user (usually 1–2 sentences), determine:

What is the product trying to do?
What is the human problem behind it?
Who is the founder, and why do they care about this problem?
How can you say all of this naturally in under 60 seconds?

🔗 CHAIN OF THOUGHT STRATEGY
Break the pitch down into 4 parts:

Set the context with a relatable hook
A line that sounds like a casual observation or insight. Make the listener lean in.

Explain the problem and the solution
Keep it grounded in a human experience — not features, but friction.

Show why you care or how it started
Add a quick personal note that builds credibility or relatability.

Invite curiosity or connection
End with something like "We're just starting out but seeing great traction," or "Would love to hear what you think," or "Happy to share more if it's relevant."

Your response should be in JSON format with the following structure:
{
  "pitch": {
    "networkingPitch": "The full networking pitch text",
    "sections": {
      "hook": "The hook section",
      "problem": "The problem statement",
      "solution": "The solution description",
      "personal": "The personal connection",
      "invitation": "The closing invitation"
    },
    "conversationStarters": ["List of 3-5 follow-up conversation starters"],
    "followUpQuestion": "A natural follow-up question to ask"
  }
}`

    const prompt = `
Business Idea: ${businessIdea}
${personalBackground ? `Personal Background: ${personalBackground}` : ""}
${goals ? `Networking Goals: ${goals}` : ""}

Based on this information, please craft my networking elevator pitch.`

    const { text } = await generateText({
      model: anthropic("claude-3-5-sonnet-20240620"),
      prompt,
      system: systemPrompt,
      maxTokens: 1000,
    })

    // Try to parse the response as JSON
    try {
      const jsonResponse = JSON.parse(text)
      return NextResponse.json({ pitch: jsonResponse.pitch })
    } catch (error) {
      // If JSON parsing fails, extract the pitch from the text
      console.error("Error parsing JSON response:", error)

      // Fallback extraction
      const networkingPitch = text.trim()
      const conversationStarters = [
        "What challenges have you faced in this space?",
        "Have you seen similar solutions in the market?",
        "What do you think would be most valuable for users like these?",
      ]
      const followUpQuestion = "What's your experience with this problem space?"

      return NextResponse.json({
        pitch: {
          networkingPitch,
          conversationStarters,
          followUpQuestion,
        },
      })
    }
  } catch (error) {
    console.error("Error generating networking pitch:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 },
    )
  }
}

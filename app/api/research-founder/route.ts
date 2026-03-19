import { NextResponse } from "next/server"
import { searchFounder } from "@/lib/exa"
import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"

export async function POST(req: Request) {
  try {
    const { name, linkedinUrl } = await req.json()

    if (!name && !linkedinUrl) {
      return NextResponse.json({ error: "Name or LinkedIn URL required" }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 })
    }

    const query = linkedinUrl || `Founder ${name}`
    const searchResults = await searchFounder(query)

    if (!searchResults || searchResults.length === 0) {
      return NextResponse.json({ error: "No public information found" }, { status: 404 })
    }

    const context = searchResults.map((r: any) => r.text).join("\n\n")

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `Based on the following public search results about a founder:
      
${context}
      
Extract and structure the following information in JSON format:
1. industryExperience (summary of their past roles)
2. relevantProjects (key startups or projects they built)
3. personalExperience (a brief bio/story)

Keep it concise but detailed enough to be useful for a "Founder Story" generator.

Return only valid JSON, no markdown code blocks.`,
      maxTokens: 1500,
    })

    let data
    try {
      const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim()
      data = JSON.parse(cleanedText)
    } catch {
      data = { summary: text }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Founder research error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

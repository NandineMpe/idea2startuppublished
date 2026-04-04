import { NextResponse } from "next/server"
import { searchFounderPublic } from "@/lib/founder-public-search"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { generateText } from "ai"
import { appendWritingRules } from "@/lib/copy-writing-rules"

export async function POST(req: Request) {
  try {
    const { name, linkedinUrl } = await req.json()

    if (!name && !linkedinUrl) {
      return NextResponse.json({ error: "Name or LinkedIn URL required" }, { status: 400 })
    }

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    const query = linkedinUrl || `Founder ${name}`
    const searchResults = await searchFounderPublic(query)

    if (!searchResults || searchResults.length === 0) {
      return NextResponse.json({ error: "No public information found" }, { status: 404 })
    }

    const context = searchResults.map((r) => r.text).join("\n\n")

    const { text } = await generateText({
      model: qwenModel(),
      prompt: appendWritingRules(`Based on the following public search results about a founder:
      
${context}
      
Extract and structure the following information in JSON format:
1. industryExperience (summary of their past roles)
2. relevantProjects (key startups or projects they built)
3. personalExperience (a brief bio/story)

Keep it concise but detailed enough to be useful for a "Founder Story" generator.

Return only valid JSON, no markdown code blocks.`),
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

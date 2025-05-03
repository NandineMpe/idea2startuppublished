import { NextResponse } from "next/server"
import { generateCompetitorAnalysis } from "./perplexity"

export async function POST(request: Request) {
  try {
    const { problem, uniqueEdge, edgePills, knownGaps } = await request.json()

    if (!problem) {
      return NextResponse.json({ error: "Problem statement is required" }, { status: 400 })
    }

    // Check if API key exists
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 })
    }

    // Construct a query from the provided information
    const query = `${problem} ${uniqueEdge ? `with unique edge: ${uniqueEdge}` : ""} ${
      edgePills.length > 0 ? `with advantages: ${edgePills.join(", ")}` : ""
    } ${knownGaps ? `addressing gaps: ${knownGaps}` : ""}`.trim()

    const result = await generateCompetitorAnalysis(query)
    return NextResponse.json({ result })
  } catch (error) {
    console.error("Error in competitor analysis route:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 },
    )
  }
}

import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE } from "@/lib/llm-provider"
import { generateCompetitorAnalysis } from "./perplexity"

export async function POST(request: Request) {
  try {
    const { problem, uniqueEdge, edgePills, knownGaps } = await request.json()

    if (!problem) {
      return NextResponse.json({ error: "Problem statement is required" }, { status: 400 })
    }

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    // Construct a query from the provided information
    const query = `${problem} ${uniqueEdge ? `with unique edge: ${uniqueEdge}` : ""} ${
      edgePills.length > 0 ? `with advantages: ${edgePills.join(", ")}` : ""
    } ${knownGaps ? `addressing gaps: ${knownGaps}` : ""}`.trim()

    const result = await generateCompetitorAnalysis(query)
    return NextResponse.json({ result })
  } catch (error) {
    return jsonApiError(500, error, "competitor-analysis POST")
  }
}

import { NextResponse } from "next/server"
import type { BusinessIdeaAnalysis } from "@/types/business-idea-analysis"

export async function POST(req: Request) {
  try {
    const { idea } = await req.json()

    if (!idea || typeof idea !== "string" || idea.trim() === "") {
      return NextResponse.json({ error: "A valid business idea is required" }, { status: 400 })
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: "DEEPSEEK_API_KEY environment variable is not set" }, { status: 500 })
    }

    const systemPrompt = `You are an expert business analyst and startup advisor. Analyze the following business idea and provide a comprehensive evaluation.
    
    Format your response as a JSON object with the following structure:
    {
      "summary": "A brief 2-3 sentence summary of the business idea",
      "strengths": ["Strength 1", "Strength 2", ...],
      "weaknesses": ["Weakness 1", "Weakness 2", ...],
      "opportunities": ["Opportunity 1", "Opportunity 2", ...],
      "threats": ["Threat 1", "Threat 2", ...],
      "marketPotential": {
        "score": A number from 1-10,
        "explanation": "Brief explanation of the score"
      },
      "feasibility": {
        "score": A number from 1-10,
        "explanation": "Brief explanation of the score"
      },
      "innovation": {
        "score": A number from 1-10,
        "explanation": "Brief explanation of the score"
      },
      "recommendation": "Your overall recommendation (Highly Recommended, Recommended, Consider with Changes, or Not Recommended)",
      "nextSteps": ["Step 1", "Step 2", ...],
      "potentialRevenues": ["Revenue stream 1", "Revenue stream 2", ...],
      "estimatedCosts": ["Cost 1", "Cost 2", ...],
      "targetAudience": ["Audience 1", "Audience 2", ...]
    }
    
    Ensure your analysis is balanced, insightful, and actionable. Be honest about potential issues but also highlight genuine opportunities.`

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: idea },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("Deepseek API error:", errorData)
      return NextResponse.json(
        {
          error: "Failed to analyze business idea with Deepseek",
          details: errorData,
        },
        { status: response.status },
      )
    }

    const data = await response.json()
    const analysisText = data.choices[0].message.content

    try {
      // Parse the JSON response
      const analysis = JSON.parse(analysisText) as BusinessIdeaAnalysis
      return NextResponse.json(analysis)
    } catch (error) {
      console.error("Error parsing Deepseek response:", error)
      console.error("Raw response:", analysisText)
      return NextResponse.json(
        {
          error: "Failed to parse Deepseek response",
          rawResponse: analysisText,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error in Deepseek idea analysis:", error)
    return NextResponse.json({ error: "Failed to analyze business idea" }, { status: 500 })
  }
}

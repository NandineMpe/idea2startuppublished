import { NextResponse } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"

const defaultSections = [
  { title: "1. PROBLEM DEFINITION & HYPOTHESIS VALIDATION", content: "Analysis not available." },
  { title: "2. MARKET NEED & DEMAND DYNAMICS", content: "Analysis not available." },
  { title: "3. ALTERNATIVES & CUSTOMER SENTIMENT", content: "Analysis not available." },
  { title: "4. USER BENEFITS & STRATEGIC GAP ANALYSIS", content: "Analysis not available." },
  { title: "5. TRENDS & ENABLING TECHNOLOGIES", content: "Analysis not available." },
  { title: "6. RISK & BARRIER ASSESSMENT", content: "Analysis not available." },
  { title: "7. MONETIZATION & BUSINESS MODEL VALIDATION", content: "Analysis not available." },
  { title: "8. TIMING & COMPETITION", content: "Analysis not available." },
  { title: "9. MACROFORCES (Regulatory, Cultural, Economic, Demographic)", content: "Analysis not available." },
  { title: "10. CONCLUSIONS & RECOMMENDATIONS", content: "Analysis not available." },
]

const SYSTEM_PROMPT = `You are a multi-disciplinary startup analyst. Analyze the proposed startup idea across 10 structured sections. Each section must be detailed with analytical sub-points. Use the exact section headers:

## 1. PROBLEM DEFINITION & HYPOTHESIS VALIDATION
## 2. MARKET NEED & DEMAND DYNAMICS
## 3. ALTERNATIVES & CUSTOMER SENTIMENT
## 4. USER BENEFITS & STRATEGIC GAP ANALYSIS
## 5. TRENDS & ENABLING TECHNOLOGIES
## 6. RISK & BARRIER ASSESSMENT
## 7. MONETIZATION & BUSINESS MODEL VALIDATION
## 8. TIMING & COMPETITION
## 9. MACROFORCES (Regulatory, Cultural, Economic, Demographic)
## 10. CONCLUSIONS & RECOMMENDATIONS

Write like a senior analyst preparing a due diligence report.`

function extractSectionsFromText(text: string) {
  const sections = []
  const sectionRegex = /## (\d+\.\s+[A-Z\s&(),]+)\n([\s\S]*?)(?=## \d+\.|$)/g
  let match
  while ((match = sectionRegex.exec(text)) !== null) {
    sections.push({ title: match[1].trim(), content: match[2].trim() })
  }
  return sections.length > 0 ? { sections } : null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ideaDescription, proposedSolution, intendedUsers, geographicFocus } = body

    if (!ideaDescription) {
      return NextResponse.json({ error: "Problem description is required", analysis: { sections: defaultSections } })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured", analysis: { sections: defaultSections } })
    }

    const prompt = `Idea: ${ideaDescription}
${proposedSolution ? `Solution: ${proposedSolution}` : ""}
${intendedUsers ? `Users: ${intendedUsers}` : ""}
${geographicFocus ? `Geography: ${geographicFocus}` : ""}`

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt,
      system: SYSTEM_PROMPT,
      maxTokens: 8000,
      temperature: 0.4,
    })

    const analysis = extractSectionsFromText(text)
    return NextResponse.json({ analysis: analysis || { sections: defaultSections } })
  } catch (error) {
    console.error("Error analyzing business idea:", error)
    return NextResponse.json({ error: "Failed to analyze", analysis: { sections: defaultSections } })
  }
}

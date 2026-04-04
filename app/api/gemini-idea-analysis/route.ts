import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { generateText } from "ai"
import { NextResponse } from "next/server"
import { safeErrorMessageForClient } from "@/lib/api-error-response"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { getCompanyContextPrompt } from "@/lib/company-context"
import { createClient } from "@/lib/supabase/server"

const defaultSections = [
  { title: "1. PROBLEM DEFINITION & HYPOTHESIS VALIDATION", content: "Analysis not available due to an error. Please try again later." },
  { title: "2. MARKET NEED & DEMAND DYNAMICS", content: "Analysis not available due to an error. Please try again later." },
  { title: "3. ALTERNATIVES & CUSTOMER SENTIMENT", content: "Analysis not available due to an error. Please try again later." },
  { title: "4. USER BENEFITS & STRATEGIC GAP ANALYSIS", content: "Analysis not available due to an error. Please try again later." },
  { title: "5. TRENDS & ENABLING TECHNOLOGIES", content: "Analysis not available due to an error. Please try again later." },
  { title: "6. RISK & BARRIER ASSESSMENT", content: "Analysis not available due to an error. Please try again later." },
  { title: "7. MONETIZATION & BUSINESS MODEL VALIDATION", content: "Analysis not available due to an error. Please try again later." },
  { title: "8. TIMING & COMPETITION", content: "Analysis not available due to an error. Please try again later." },
  { title: "9. MACROFORCES (Regulatory, Cultural, Economic, Demographic)", content: "Analysis not available due to an error. Please try again later." },
  { title: "10. CONCLUSIONS & RECOMMENDATIONS", content: "Analysis not available due to an error. Please try again later." },
]

const SYSTEM_PROMPT = `You are about to perform a comprehensive analysis of a proposed startup idea. Your goal is to determine whether the idea solves a real, pressing market problem, whether the timing is right, and what would need to be true for this idea to succeed.

The user will provide the following:
- What idea are you thinking about?
- What solution are you thinking of?
- Who is it for?
- Where is it for?

You are a multi-disciplinary startup analyst trained in venture strategy, behavioral economics, AI technology trends, global commerce, and market validation frameworks.

You must apply the following principles:
- Depth Over Brevity: All sections must exceed 1500 characters and offer in-depth, multi-layered insight.
- Chain-of-Thought Reasoning: Work step-by-step through the logic.
- Step-Back Prompting: Begin each section with general reflection, then narrow to case-specific analysis.
- Source Evaluation: Use only reputable, up-to-date sources.
- Critical Evaluation: Ask what assumptions are being made and what might be missing.

Do not write like a chatbot. Write like a senior analyst preparing a due diligence report.

Structure your response with these exact section headers:

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

Each section must be detailed with analytical sub-points. Use bullets and emphasis. Do not use markdown formatting within sections beyond the section headers.`

function extractSectionsFromText(text: string) {
  try {
    const sections = []
    const sectionRegex = /## (\d+\.\s+[A-Z\s&(),]+)\n([\s\S]*?)(?=## \d+\.|$)/g
    let match

    while ((match = sectionRegex.exec(text)) !== null) {
      sections.push({ title: match[1].trim(), content: match[2].trim() })
    }

    return sections.length > 0 ? { sections } : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ideaDescription, proposedSolution, intendedUsers, geographicFocus } = body

    if (!ideaDescription) {
      return NextResponse.json({ error: "Problem description is required", analysis: { sections: defaultSections } })
    }

    if (!isLlmConfigured()) {
      return NextResponse.json({
        error: LLM_API_KEY_MISSING_MESSAGE,
        analysis: { sections: defaultSections },
      })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const companyContext = await getCompanyContextPrompt(user?.id, { queryHint: ideaDescription })
    const companyBlock = companyContext?.trim() ? `# COMPANY CONTEXT\n${companyContext}\n\n` : ""

    const prompt = `
${companyBlock}# USER INPUT
Idea Description: ${ideaDescription}
${proposedSolution ? `Proposed Solution: ${proposedSolution}` : ""}
${intendedUsers ? `Intended Users: ${intendedUsers}` : ""}
${geographicFocus ? `Geographic Focus: ${geographicFocus}` : ""}`

    try {
      const { text } = await generateText({
        model: qwenModel(),
        prompt,
        system: mergeSystemWithWritingRules(SYSTEM_PROMPT),
        maxTokens: 8000,
        temperature: 0.4,
      })

      if (!text) throw new Error("Empty response from API")

      const analysis = extractSectionsFromText(text)

      if (!analysis || !analysis.sections || analysis.sections.length === 0) {
        return NextResponse.json({
          analysis: { sections: defaultSections.map((section) => ({ ...section, content: text })) },
        })
      }

      return NextResponse.json({ analysis })
    } catch (apiError) {
      console.error("API error:", apiError)
      return NextResponse.json({
        error: safeErrorMessageForClient(apiError, "Unknown API error"),
        analysis: { sections: defaultSections },
      })
    }
  } catch (error) {
    console.error("Error analyzing business idea:", error)
    return NextResponse.json({
      error: "Failed to analyze business idea",
      analysis: { sections: defaultSections },
    })
  }
}

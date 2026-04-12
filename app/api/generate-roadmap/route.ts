import { NextResponse } from "next/server"
import { qwenModel } from "@/lib/llm-provider"
import { jsonApiError } from "@/lib/api-error-response"
import { generateText } from "ai"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContextPrompt } from "@/lib/company-context"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"

const SYSTEM_PROMPT = `You are a product strategy and roadmap expert trained in agile product management, the RICE framework, and startup execution strategy. Generate a detailed, actionable product roadmap.

The user will provide:
- Product description
- Current stage (idea/MVP/launched)
- Key goals (optional)
- Timeline preference (optional)

Return a structured response with the following sections:

## PRODUCT VISION
A clear 1-2 sentence product vision statement that describes the end-state you're building toward.

## PHASE 1: FOUNDATION (Weeks 1-4)
List 4-6 specific tasks/features for this phase. For each, include:
- Task name
- Description (1-2 sentences)
- Priority (Critical/High/Medium)
- Estimated effort (days)
Focus on: Core infrastructure, essential features for first users, basic architecture.

## PHASE 2: CORE PRODUCT (Weeks 5-10)
List 4-6 specific tasks/features. Same format.
Focus on: Core value proposition delivery, key user workflows, essential integrations.

## PHASE 3: GROWTH & POLISH (Weeks 11-16)
List 4-6 specific tasks/features. Same format.
Focus on: User experience refinement, analytics, growth features, onboarding optimization.

## PHASE 4: SCALE (Weeks 17-24)
List 4-6 specific tasks/features. Same format.
Focus on: Performance optimization, advanced features, monetization, team scaling.

## KEY MILESTONES
5-8 specific milestones with target dates and success criteria. Format each as:
- Milestone name | Target week | Success criteria

## TECHNICAL STACK RECOMMENDATIONS
Recommended technology choices with rationale, considering the product type and scale requirements.

## RISKS AND DEPENDENCIES
Key risks to the roadmap and external dependencies that could impact timeline.

## SUCCESS METRICS
5-8 KPIs to track progress, with target values for each phase.

Be specific and actionable. Every task should be something a developer or team could pick up and execute. Avoid vague descriptions.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { productDescription, currentStage, keyGoals, timeline } = body

    if (!productDescription) {
      return NextResponse.json({ error: "Product description is required" }, { status: 400 })
    }

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const companyContext = await getCompanyContextPrompt(user?.id, {})
    const companyBlock = companyContext?.trim() ? `# COMPANY CONTEXT\n${companyContext}\n\n` : ""

    const prompt = `${companyBlock}# USER INPUT
Product: ${productDescription}
${currentStage ? `Current Stage: ${currentStage}` : ""}
${keyGoals ? `Key Goals: ${keyGoals}` : ""}
${timeline ? `Timeline Preference: ${timeline}` : ""}`

    const { text } = await generateText({
      model: qwenModel(),
      prompt,
      system: mergeSystemWithWritingRules(SYSTEM_PROMPT),
      maxTokens: 4000,
      temperature: 0.5,
    })

    if (!text) throw new Error("Empty response from API")

    const sections: Record<string, string> = {}
    const sectionRegex = /## ([A-Z\s&/:()0-9-]+)\n([\s\S]*?)(?=## [A-Z]|$)/g
    let match
    while ((match = sectionRegex.exec(text)) !== null) {
      sections[match[1].trim()] = match[2].trim()
    }

    return NextResponse.json({ sections, raw: text })
  } catch (error) {
    return jsonApiError(500, error, "generate-roadmap POST")
  }
}

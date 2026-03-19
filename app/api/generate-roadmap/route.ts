import { NextResponse } from "next/server"
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"

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

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ error: "Google Gemini API key is not configured" }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { temperature: 0.5, topP: 0.95, topK: 40 },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ],
    })

    const prompt = `${SYSTEM_PROMPT}

# USER INPUT
Product: ${productDescription}
${currentStage ? `Current Stage: ${currentStage}` : ""}
${keyGoals ? `Key Goals: ${keyGoals}` : ""}
${timeline ? `Timeline Preference: ${timeline}` : ""}`

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), 120000)),
    ]) as any

    const response = await result.response
    const text = response.text()

    if (!text) throw new Error("Empty response from API")

    const sections: Record<string, string> = {}
    const sectionRegex = /## ([A-Z\s&/:()0-9-]+)\n([\s\S]*?)(?=## [A-Z]|$)/g
    let match
    while ((match = sectionRegex.exec(text)) !== null) {
      sections[match[1].trim()] = match[2].trim()
    }

    return NextResponse.json({ sections, raw: text })
  } catch (error) {
    console.error("Roadmap generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate roadmap" },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"

const SYSTEM_PROMPT = `You are a business model architect trained in the Business Model Canvas (Osterwalder), Lean Canvas (Ash Maurya), and venture strategy frameworks. Generate a comprehensive business model analysis.

The user will provide:
- Business idea description
- Target market
- Revenue approach (optional)
- Stage (idea/MVP/growth)

Return a structured response with the following sections, each clearly labeled:

## VALUE PROPOSITIONS
What value do you deliver to the customer? Which customer needs are you satisfying? Be specific about the unique value.

## CUSTOMER SEGMENTS
Who are the most important customers? Define 2-3 primary segments with their characteristics, needs, and size estimates.

## CHANNELS
Through which channels do your customer segments want to be reached? How are you reaching them now? List specific channel strategies.

## CUSTOMER RELATIONSHIPS
What type of relationship does each customer segment expect? Personal assistance, self-service, automated, community, co-creation?

## REVENUE STREAMS
For what value are customers willing to pay? How would they prefer to pay? List specific revenue models with pricing strategies.

## KEY RESOURCES
What key resources does your value proposition require? Physical, intellectual, human, and financial resources needed.

## KEY ACTIVITIES
What key activities does your value proposition require? Production, problem-solving, platform/network activities.

## KEY PARTNERSHIPS
Who are your key partners and suppliers? What key resources are you acquiring from partners?

## COST STRUCTURE
What are the most important costs inherent in your business model? Fixed costs, variable costs, economies of scale.

## COMPETITIVE MOAT
What sustainable competitive advantages can you build? Network effects, data advantages, brand, switching costs, patents.

## UNIT ECONOMICS
Break down the unit economics: Customer Acquisition Cost (CAC), Lifetime Value (LTV), payback period, gross margin targets.

## RISKS AND ASSUMPTIONS
What are the key assumptions this business model relies on? What are the biggest risks? How can they be mitigated?

Be analytical and specific. Use real-world comparisons where helpful. Avoid generic statements.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessIdea, targetMarket, revenueApproach, stage } = body

    if (!businessIdea) {
      return NextResponse.json({ error: "Business idea description is required" }, { status: 400 })
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
Business Idea: ${businessIdea}
${targetMarket ? `Target Market: ${targetMarket}` : ""}
${revenueApproach ? `Revenue Approach: ${revenueApproach}` : ""}
${stage ? `Current Stage: ${stage}` : ""}`

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), 120000)),
    ]) as any

    const response = await result.response
    const text = response.text()

    if (!text) throw new Error("Empty response from API")

    const sections: Record<string, string> = {}
    const sectionRegex = /## ([A-Z\s&/]+)\n([\s\S]*?)(?=## [A-Z]|$)/g
    let match
    while ((match = sectionRegex.exec(text)) !== null) {
      sections[match[1].trim()] = match[2].trim()
    }

    return NextResponse.json({ sections, raw: text })
  } catch (error) {
    console.error("Business model generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate business model" },
      { status: 500 }
    )
  }
}

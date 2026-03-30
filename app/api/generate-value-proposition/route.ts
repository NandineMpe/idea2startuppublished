import { NextResponse } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { jsonApiError } from "@/lib/api-error-response"
import { generateText } from "ai"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContextPrompt } from "@/lib/company-context"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"

const SYSTEM_PROMPT = `You are a value proposition strategist trained in Jobs-to-be-Done theory, the Value Proposition Canvas, and positioning frameworks from April Dunford. Your role is to generate a comprehensive, actionable value proposition for a startup.

The user will provide:
- Product/Service description
- Target customer segment
- Key problem being solved
- Existing alternatives (optional)

You must return a structured response with the following sections, each clearly labeled:

## HEADLINE
A single, powerful value proposition statement (1-2 sentences max). This should be the kind of headline you'd put on a landing page.

## SUBHEADLINE
A supporting statement that adds context (2-3 sentences).

## TARGET CUSTOMER
A detailed description of the ideal customer: who they are, what they care about, their pain points, and what triggers them to seek a solution.

## CUSTOMER JOBS
List the functional, emotional, and social jobs the customer is trying to get done. For each job, explain the pain points and desired gains.

## PAIN RELIEVERS
How the product specifically addresses each pain point. Be concrete and specific.

## GAIN CREATORS
How the product creates value beyond just solving the problem. What delights, surprises, or exceeds expectations.

## UNIQUE DIFFERENTIATORS
3-5 specific reasons why this solution is meaningfully different from alternatives. For each, explain WHY it matters to the customer.

## POSITIONING STATEMENT
A formal positioning statement in the format: "For [target customer] who [need/opportunity], [product] is a [category] that [key benefit]. Unlike [alternatives], we [key differentiator]."

## MESSAGING FRAMEWORK
3 key messages with supporting proof points that can be used across marketing channels.

## VALIDATION EXPERIMENTS
3-5 specific experiments the founder can run to validate this value proposition with real customers.

Write with analytical rigor. Be specific, not generic. Reference real market dynamics where possible.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { productDescription, targetCustomer, problemSolved, existingAlternatives } = body

    if (!productDescription) {
      return NextResponse.json({ error: "Product description is required" }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const companyContext = await getCompanyContextPrompt(user?.id)
    const companyBlock = companyContext?.trim() ? `# COMPANY CONTEXT\n${companyContext}\n\n` : ""

    const prompt = `${companyBlock}# USER INPUT
Product/Service: ${productDescription}
${targetCustomer ? `Target Customer: ${targetCustomer}` : ""}
${problemSolved ? `Problem Being Solved: ${problemSolved}` : ""}
${existingAlternatives ? `Existing Alternatives: ${existingAlternatives}` : ""}`

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt,
      system: mergeSystemWithWritingRules(SYSTEM_PROMPT),
      maxTokens: 4000,
      temperature: 0.5,
    })

    if (!text) throw new Error("Empty response from API")

    const sections: Record<string, string> = {}
    const sectionRegex = /## ([A-Z\s&/]+)\n([\s\S]*?)(?=## [A-Z]|$)/g
    let match
    while ((match = sectionRegex.exec(text)) !== null) {
      sections[match[1].trim()] = match[2].trim()
    }

    return NextResponse.json({ sections, raw: text })
  } catch (error) {
    return jsonApiError(500, error, "generate-value-proposition POST")
  }
}

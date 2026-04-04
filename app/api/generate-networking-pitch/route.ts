import { NextResponse } from "next/server"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { jsonApiError } from "@/lib/api-error-response"
import { generateText } from "ai"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContextPrompt } from "@/lib/company-context"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"

export async function POST(request: Request) {
  try {
    const { businessIdea, personalBackground, goals } = await request.json()

    if (!businessIdea) {
      return NextResponse.json({ error: "Business idea is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const companyContext = await getCompanyContextPrompt(user?.id)
    const companyBlock = companyContext?.trim() ? `# COMPANY CONTEXT\n${companyContext}\n\n` : ""

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    const systemPrompt = `You are an expert in networking and personal branding for entrepreneurs. Your task is to help craft a compelling elevator pitch for networking events based on the information provided.

Create a concise, memorable networking pitch that follows this structure:
1. Introduction: A brief personal introduction that establishes credibility
2. Problem: A clear statement of the problem being solved
3. Solution: A simple explanation of the solution that anyone can understand
4. Impact: The difference this solution makes for users/customers
5. Personal Connection: Why this matters to you personally
6. Invitation: An open-ended question or statement that invites further conversation

The pitch should be:
- Very concise (30-60 seconds when spoken, about 100-150 words)
- Conversational and natural-sounding
- Memorable with a clear "hook"
- Free of technical jargon unless speaking to industry peers
- Authentic to the founder's voice and passion
- Designed to spark curiosity and questions

This pitch will be used for networking events, conferences, and casual introductions, so it should be adaptable to different audiences while maintaining authenticity.`

    const prompt = `${companyBlock}
Business Idea: ${businessIdea}
${personalBackground ? `Personal Background: ${personalBackground}` : ""}
${goals ? `Networking Goals: ${goals}` : ""}

Based on this information, please craft my networking elevator pitch.`

    const { text } = await generateText({
      model: qwenModel(),
      prompt,
      system: mergeSystemWithWritingRules(systemPrompt),
      maxTokens: 1000,
    })

    return NextResponse.json({ pitch: text })
  } catch (error) {
    return jsonApiError(500, error, "generate-networking-pitch POST")
  }
}

import { NextResponse } from "next/server"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { isProduction, logApiError } from "@/lib/api-error-response"
import { streamText } from "ai"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContextPrompt } from "@/lib/company-context"

const slidePrompts: Record<string, string> = {
  problem: `You are an expert pitch deck consultant. Generate content for the PROBLEM slide. Focus on: clearly articulating the problem, why it matters, quantifying impact, making it relatable and urgent. Keep to 150-200 words in a professional, investor-focused tone.`,
  solution: `You are an expert pitch deck consultant. Generate content for the SOLUTION slide. Focus on: how your solution works, unique approach, why it's better than alternatives, connecting to the problem. Keep to 150-200 words in a professional tone.`,
  market: `You are an expert pitch deck consultant. Generate content for the MARKET slide. Focus on: TAM/SAM/SOM, market size figures, growth rates, key trends, why the market is attractive. Keep to 150-200 words.`,
  "business-model": `You are an expert pitch deck consultant. Generate content for the BUSINESS MODEL slide. Focus on: how you make money, pricing strategy, sales channels, unit economics. Keep to 150-200 words.`,
  traction: `You are an expert pitch deck consultant. Generate content for the TRACTION slide. Focus on: key metrics, growth, notable customers, milestones, momentum. Keep to 150-200 words.`,
  team: `You are an expert pitch deck consultant. Generate content for the TEAM slide. Focus on: relevant experience, why this team is uniquely positioned, achievements, advisors. Keep to 150-200 words.`,
  ask: `You are an expert pitch deck consultant. Generate content for the ASK slide. Focus on: how much funding, use of funds, key milestones, timeline. Keep to 150-200 words.`,
}

export async function POST(req: Request) {
  try {
    const { slideType, slideData } = await req.json()

    if (!slideType || !slideData) {
      return NextResponse.json({ error: "Slide type and data are required" }, { status: 400 })
    }

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const companyContext = await getCompanyContextPrompt(user?.id)
    const companyBlock = companyContext?.trim() ? `# COMPANY CONTEXT\n${companyContext}\n\n` : ""

    const systemPrompt = slidePrompts[slideType] || "You are an expert pitch deck consultant. Create compelling content for a pitch deck slide."

    let userMessage = companyBlock + "Generate content for my pitch deck slide based on this information:\n\n"
    Object.entries(slideData).forEach(([key, value]) => {
      if (value && typeof value === "string" && value.trim() !== "") {
        userMessage += `${key}: ${value}\n`
      }
    })

    const result = streamText({
      model: qwenModel(),
      system: mergeSystemWithWritingRules(systemPrompt),
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 500,
      temperature: 0.7,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    logApiError("generate-pitch-slide POST", error)
    return NextResponse.json(
      {
        error: "Failed to generate pitch slide content",
        ...(!isProduction()
          ? { details: error instanceof Error ? error.message : "Unknown error" }
          : {}),
      },
      { status: 500 },
    )
  }
}

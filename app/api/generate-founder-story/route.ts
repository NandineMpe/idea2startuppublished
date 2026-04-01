import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import { NextResponse } from "next/server"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { getCompanyContextPrompt } from "@/lib/company-context"
import { createClient } from "@/lib/supabase/server"

const fallbackStory = `I noticed a significant problem in my industry that wasn't being addressed effectively. Drawing on my background and expertise, I decided to create a solution that would make a real difference.

What started as a simple idea has grown into something much bigger. We're now helping customers overcome challenges they've faced for years, and the feedback has been incredibly positive.

Our mission is to continue innovating and expanding our reach, making this solution accessible to everyone who needs it. I'm excited about the journey ahead and the impact we can make.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      personalExperience,
      selectedEmotion,
      ahaMoment,
      selectedTone,
      industryExperience,
      relevantProjects,
      networkAdvantages,
      whyNow,
    } = body

    if (!personalExperience || !selectedTone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 })
    }

    const formattedInput = {
      personalExperience,
      emotion: selectedEmotion,
      ahaMoment,
      credibility: { industryExperience, relevantProjects, networkAdvantages, whyNow },
      tone: selectedTone,
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const companyContext = await getCompanyContextPrompt(user?.id, {
      queryHint: `${personalExperience} ${industryExperience} ${relevantProjects}`.substring(0, 300),
    })
    const companyBlock = companyContext?.trim() ? `# COMPANY CONTEXT\n${companyContext}\n\n` : ""

    const systemPrompt = `Founder Story Builder - Expert-Level Narrative Creation
You are a seasoned storytelling expert, founder coach, and brand strategist working with visionary entrepreneurs. Your goal is to help them transform their raw, real-life experiences into a compelling, credible, emotionally resonant founder story.

${companyBlock}You are now supporting a user who has completed a guided 3-part flow:
- Personal Experience - The frustration or pain point they experienced.
- Credibility Mapping - Why they are uniquely suited to solve this problem.
- Aha Moment - The turning point where they committed to building this business.

Craft a high-impact founder narrative for the selected tone:
- VC Pitch -> concise, confident, credibility-focused
- Team Building -> purpose-driven, values-aligned, mission-first
- Press & Media -> emotionally engaging, clear arc, socially resonant

Write in a natural, confident tone. Include 1-2 relevant industry statistics. Create emotional resonance. End with a purpose-driven closing line. Use plain text formatting with paragraph breaks.`

    try {
      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: JSON.stringify(formattedInput),
        system: mergeSystemWithWritingRules(systemPrompt),
        maxTokens: 2000,
      })

      return NextResponse.json({ story: text || fallbackStory })
    } catch (err) {
      console.error("Error generating founder story:", err)
      return NextResponse.json({ error: "Failed to generate founder story. Please try again." }, { status: 500 })
    }
  } catch (error) {
    console.error("Error in founder story route:", error)
    return NextResponse.json({ error: "Failed to generate founder story" }, { status: 500 })
  }
}

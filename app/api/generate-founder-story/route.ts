import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

// Fallback story in case of API failure
const fallbackStory = `I noticed a significant problem in my industry that wasn't being addressed effectively. Drawing on my background and expertise, I decided to create a solution that would make a real difference. 

What started as a simple idea has grown into something much bigger. We're now helping customers overcome challenges they've faced for years, and the feedback has been incredibly positive.

Our mission is to continue innovating and expanding our reach, making this solution accessible to everyone who needs it. I'm excited about the journey ahead and the impact we can make.`

export async function POST(request: Request) {
  try {
    // Parse the request body
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

    // Validate required fields
    if (!personalExperience || !selectedTone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if API key is available
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      console.error("Gemini API key is not configured")
      return NextResponse.json(
        { error: "Gemini API key is not configured. Please set the GOOGLE_GEMINI_API_KEY environment variable." },
        { status: 500 },
      )
    }

    // Format the input for the Gemini API
    const formattedInput = {
      personalExperience,
      emotion: selectedEmotion,
      ahaMoment,
      credibility: {
        industryExperience,
        relevantProjects,
        networkAdvantages,
        whyNow,
      },
      tone: selectedTone,
    }

    try {
      // Initialize Gemini
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
      // Use gemini-2.5-pro (latest stable)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" })

      // Query Supermemory for relevant context
      let memoryContext = ""
      try {
        const { queryMemory } = await import("@/lib/supermemory")
        // Use personal experience + industry experience as query hook
        const query = `${personalExperience} ${industryExperience} ${relevantProjects}`.substring(0, 300)
        const memories = await queryMemory(query)
        if (memories && memories.length > 0) {
          memoryContext = memories.map((m: any) => m.content || JSON.stringify(m)).join("\n---\n")
        }
      } catch (e) {
        console.warn("Super Brain query failed:", e)
      }

      const systemPrompt = `Founder Story Builder – Expert-Level Narrative Creation
You are a seasoned storytelling expert, founder coach, and brand strategist working with visionary entrepreneurs. Your goal is to help them transform their raw, real-life experiences into a compelling, credible, emotionally resonant founder story.

# SUPER BRAIN CONTEXT (User's Uploaded Intelligence)
Use the following background information (if any) to enrich the story with specific industry details or philosophy, but ONLY if relevant to the narrative arc:
${memoryContext}

You are now supporting a user who has just completed a guided 3-part flow in our Founder Story Builder. They've filled out:

Personal Experience – The frustration or pain point they experienced.

Credibility Mapping – Why they are uniquely suited to solve this problem.

Aha Moment – The turning point where it all clicked and they committed to building this business.

Your task is to take these insights and craft a high-impact founder narrative, suitable for the tone selected:

VC Pitch → concise, confident, credibility-focused

Team Building → purpose-driven, values-aligned, mission-first

Press & Media → emotionally engaging, clear arc, socially resonant

Instructions:
Write in a natural, confident tone that mirrors how a founder would speak when asked, "So why did you start this?"

Prioritize insight over fluff. Be clear, concise, and specific.

Include 1-2 relevant industry statistics or market insights that strengthen the narrative without overwhelming it. Choose only the most impactful data points that highlight the opportunity or problem severity.

Use powerful transitions to connect the experience, credibility, and aha moment into a coherent story.

Incorporate vulnerability, humanity, and clarity of mission.

Highlight any industry experience, traction, or network advantages without sounding boastful.

Create emotional resonance by tying the personal experience to the broader mission.

If business details like business name, business model, value proposition, target audience, or industry category are provided, incorporate them naturally into the story to create a cohesive narrative.

If market analysis data is provided, use it to strengthen the story with relevant statistics and insights.

End with a line that captures purpose and ambition, e.g. "That's why I started [company] — to make sure no one else has to go through what I did."

Format the story with proper paragraph breaks using double newlines. Use plain text formatting - do not use markdown formatting like headings, bullet points, or other special characters.`

      // Generate content
      const result = await model.generateContent([
        systemPrompt,
        JSON.stringify(formattedInput)
      ])

      const response = await result.response
      const generatedStory = response.text()

      // Return the generated story
      return NextResponse.json({ story: generatedStory || fallbackStory })
    } catch (geminiError) {
      console.error("Error generating founder story with Gemini:", geminiError)
      return NextResponse.json(
        { error: "Failed to generate founder story. Please try again." },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error in founder story route:", error)
    return NextResponse.json(
      { error: "Failed to generate founder story" },
      { status: 500 }
    )
  }
}

import { OpenAIStream, StreamingTextResponse } from "ai"
import { OpenAI } from "openai"

// Create an OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { slideType, businessData } = await req.json()

    // Define system prompts based on slide type
    const systemPrompts: Record<string, string> = {
      problem:
        "You are an expert pitch deck consultant. Create compelling content for the 'Problem' slide of a pitch deck. Focus on clearly articulating the problem, its scope, and why it matters. Use concise language that resonates with investors.",
      solution:
        "You are an expert pitch deck consultant. Create compelling content for the 'Solution' slide of a pitch deck. Clearly explain how the product/service solves the problem, highlight key features and benefits, and emphasize the unique value proposition.",
      market:
        "You are an expert pitch deck consultant. Create compelling content for the 'Market' slide of a pitch deck. Include market size (TAM, SAM, SOM), growth trends, and market dynamics. Use specific numbers and data points when possible.",
      business:
        "You are an expert pitch deck consultant. Create compelling content for the 'Business Model' slide of a pitch deck. Explain how the business makes money, pricing strategy, sales channels, and customer acquisition approach.",
      competition:
        "You are an expert pitch deck consultant. Create compelling content for the 'Competition' slide of a pitch deck. Identify key competitors, highlight your competitive advantages, and explain your unique positioning in the market.",
      traction:
        "You are an expert pitch deck consultant. Create compelling content for the 'Traction' slide of a pitch deck. Showcase growth metrics, key milestones achieved, customer testimonials, and any validation points that demonstrate momentum.",
      team: "You are an expert pitch deck consultant. Create compelling content for the 'Team' slide of a pitch deck. Highlight key team members, their relevant experience, and why this team is uniquely positioned to execute on this opportunity.",
      financials:
        "You are an expert pitch deck consultant. Create compelling content for the 'Financials' slide of a pitch deck. Include revenue projections, key metrics, funding requirements, and use of funds. Be realistic but ambitious.",
      ask: "You are an expert pitch deck consultant. Create compelling content for the 'Ask' slide of a pitch deck. Clearly state what you're asking for (investment amount), how the funds will be used, and the expected outcomes/milestones that will be achieved.",
    }

    // Get the appropriate system prompt
    const systemPrompt =
      systemPrompts[slideType] ||
      "You are an expert pitch deck consultant. Create compelling content for a pitch deck slide."

    // Use a valid model name - gpt-4o is the latest and most capable model
    const model = "gpt-4o"

    console.log(`Using model: ${model} for pitch slide generation`)

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Create content for the ${slideType} slide of my pitch deck. Here's information about my business: ${JSON.stringify(businessData)}`,
        },
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 500,
    })

    // Create a stream from the OpenAI response
    const stream = OpenAIStream(response)

    // Return a StreamingTextResponse, which will stream the response to the client
    return new StreamingTextResponse(stream)
  } catch (error) {
    console.error("Error in pitch slide generation:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to generate pitch slide content",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
}

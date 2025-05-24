import { NextResponse } from "next/server"
import { DeepseekStream, StreamingTextResponse } from "@/lib/deepseek-stream"

export const runtime = "edge"

// Define the slide types and their prompts - moved outside the handler for better performance
const slidePrompts: Record<string, string> = {
  problem: `You are an expert pitch deck consultant helping founders create compelling pitch decks. 
  Generate content for the PROBLEM slide of a pitch deck based on the information provided.
  
  Focus on:
  - Clearly articulating the problem
  - Explaining why this problem matters
  - Quantifying the impact of the problem when possible
  - Making the problem relatable and urgent
  
  Format your response as plain text that can be directly used in a pitch deck slide.
  Keep your response concise but impactful - around 150-200 words.
  Use a professional, confident tone that would appeal to investors.`,

  solution: `You are an expert pitch deck consultant helping founders create compelling pitch decks. 
  Generate content for the SOLUTION slide of a pitch deck based on the information provided.
  
  Focus on:
  - Clearly explaining how your solution works
  - Highlighting your unique approach or technology
  - Explaining why your solution is better than alternatives
  - Connecting your solution directly to the problem you identified
  
  Format your response as plain text that can be directly used in a pitch deck slide.
  Keep your response concise but impactful - around 150-200 words.
  Use a professional, confident tone that would appeal to investors.`,

  market: `You are an expert pitch deck consultant helping founders create compelling pitch decks. 
  Generate content for the MARKET slide of a pitch deck based on the information provided.
  
  Focus on:
  - Defining your Total Addressable Market (TAM), Serviceable Available Market (SAM), and Serviceable Obtainable Market (SOM)
  - Including relevant market size figures and growth rates
  - Identifying key market trends that support your business
  - Explaining why this market is attractive
  
  Format your response as plain text that can be directly used in a pitch deck slide.
  Keep your response concise but impactful - around 150-200 words.
  Use a professional, confident tone that would appeal to investors.`,

  "business-model": `You are an expert pitch deck consultant helping founders create compelling pitch decks. 
  Generate content for the BUSINESS MODEL slide of a pitch deck based on the information provided.
  
  Focus on:
  - Clearly explaining how you make money
  - Outlining your pricing strategy
  - Describing your sales and distribution channels
  - Highlighting unit economics and margins if possible
  
  Format your response as plain text that can be directly used in a pitch deck slide.
  Keep your response concise but impactful - around 150-200 words.
  Use a professional, confident tone that would appeal to investors.`,

  traction: `You are an expert pitch deck consultant helping founders create compelling pitch decks. 
  Generate content for the TRACTION slide of a pitch deck based on the information provided.
  
  Focus on:
  - Highlighting key metrics and growth
  - Mentioning notable customers or partnerships
  - Describing milestones achieved
  - Showing momentum and progress
  
  Format your response as plain text that can be directly used in a pitch deck slide.
  Keep your response concise but impactful - around 150-200 words.
  Use a professional, confident tone that would appeal to investors.`,

  team: `You are an expert pitch deck consultant helping founders create compelling pitch decks. 
  Generate content for the TEAM slide of a pitch deck based on the information provided.
  
  Focus on:
  - Highlighting relevant experience and expertise
  - Explaining why this team is uniquely positioned to solve this problem
  - Mentioning notable achievements or credentials
  - Identifying any key advisors or board members
  
  Format your response as plain text that can be directly used in a pitch deck slide.
  Keep your response concise but impactful - around 150-200 words.
  Use a professional, confident tone that would appeal to investors.`,

  ask: `You are an expert pitch deck consultant helping founders create compelling pitch decks. 
  Generate content for the ASK slide of a pitch deck based on the information provided.
  
  Focus on:
  - Clearly stating how much funding you're seeking
  - Explaining how the funds will be used
  - Outlining key milestones the funding will help you achieve
  - Including a timeline if relevant
  
  Format your response as plain text that can be directly used in a pitch deck slide.
  Keep your response concise but impactful - around 150-200 words.
  Use a professional, confident tone that would appeal to investors.`,
}

// Default system prompt
const DEFAULT_SYSTEM_PROMPT =
  "You are an expert pitch deck consultant. Create compelling content for a pitch deck slide."

export async function POST(req: Request) {
  try {
    const { slideType, slideData } = await req.json()

    // Validate required fields
    if (!slideType || !slideData) {
      return NextResponse.json({ error: "Slide type and data are required" }, { status: 400 })
    }

    // Check if API key is available
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: "DEEPSEEK_API_KEY environment variable is not set" }, { status: 500 })
    }

    // Get the appropriate system prompt
    const systemPrompt = slidePrompts[slideType] || DEFAULT_SYSTEM_PROMPT

    // Format the user message based on the slide data
    const userMessage = formatUserMessage(slideData)

    console.log(`Using Deepseek for pitch slide generation: ${slideType}`)

    // Call Deepseek API
    const response = await callDeepseekAPI(systemPrompt, userMessage)

    // Check if the response is OK
    if (!response.ok) {
      return handleErrorResponse(response)
    }

    // Convert the response into a friendly text-stream
    const stream = DeepseekStream(response)

    // Respond with the stream
    return new StreamingTextResponse(stream)
  } catch (error) {
    return handleException(error)
  }
}

// Helper function to format user message
function formatUserMessage(slideData: Record<string, any>): string {
  let userMessage = "Please generate content for my pitch deck slide based on this information:\n\n"

  Object.entries(slideData).forEach(([key, value]) => {
    if (value && typeof value === "string" && value.trim() !== "") {
      userMessage += `${key}: ${value}\n`
    }
  })

  return userMessage
}

// Helper function to call Deepseek API
async function callDeepseekAPI(systemPrompt: string, userMessage: string): Promise<Response> {
  const requestBody = JSON.stringify({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 500,
    stream: true,
  })

  return fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: requestBody,
  })
}

// Helper function to handle error responses
async function handleErrorResponse(response: Response): Promise<Response> {
  const errorText = await response.text()
  let errorMessage

  try {
    const errorData = JSON.parse(errorText)
    errorMessage = errorData.error?.message || "Unknown error"
  } catch (parseError) {
    errorMessage = `Failed to fetch from Deepseek API: ${response.status} ${response.statusText}. Response: ${errorText.substring(0, 200)}`
  }

  return NextResponse.json({ error: errorMessage }, { status: response.status })
}

// Helper function to handle exceptions
function handleException(error: unknown): Response {
  console.error("Error in pitch slide generation:", error)

  let errorDetails
  if (error instanceof Error) {
    errorDetails = error.message
  } else if (typeof error === "string") {
    errorDetails = error
  } else {
    errorDetails = "Unknown error occurred"
  }

  return NextResponse.json(
    {
      error: "Failed to generate pitch slide content",
      details: errorDetails,
    },
    { status: 500 },
  )
}

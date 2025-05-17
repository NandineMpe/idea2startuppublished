import { NextResponse } from "next/server"
import { DeepseekStream, StreamingTextResponse } from "@/lib/deepseek-stream"

// IMPORTANT: Set the runtime to edge
export const runtime = "edge"

export async function POST(req: Request) {
  // Extract the `messages` from the body of the request
  const { messages } = await req.json()

  // Check if the DEEPSEEK_API_KEY is set
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      {
        error: "Missing DEEPSEEK_API_KEY environment variable",
      },
      { status: 500 },
    )
  }

  // Ask Deepseek for a streaming chat completion
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      stream: true,
    }),
  })

  // Check if the response is OK
  if (!response.ok) {
    let errorMessage
    try {
      const errorData = await response.json()
      errorMessage = errorData.error?.message || "Unknown error"
    } catch (error) {
      errorMessage = `Failed to fetch from Deepseek API: ${response.statusText}`
    }
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: response.status },
    )
  }

  // Convert the response into a friendly text-stream
  const stream = DeepseekStream(response)

  // Respond with the stream
  return new StreamingTextResponse(stream)
}

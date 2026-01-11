import { GoogleGenerativeAI } from "@google/generative-ai"
import { GeminiStream } from "@/lib/gemini-stream"
import { StreamingTextResponse } from "@/lib/deepseek-stream" // Reusing text response wrapper

export const runtime = "edge"

export async function POST(req: Request) {
    try {
        const { messages } = await req.json()

        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            return new Response(JSON.stringify({ error: "Missing GOOGLE_GEMINI_API_KEY" }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)

        // Using gemini-2.5-pro for chat as requested
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" })

        // Convert messages to Gemini format
        // Gemini expects simplified roles and history. 
        // It's stateless by default unless using startChat, but here we likely just want single-turn or simple history mapping

        // Simple Prompt construction for now:
        const lastMessage = messages[messages.length - 1].content

        // Construct history from previous messages
        const history = messages.slice(0, -1).map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }))

        const chat = model.startChat({
            history: history,
            generationConfig: {
                maxOutputTokens: 1000,
            },
        })

        const result = await chat.sendMessageStream(lastMessage)

        // Convert to readable stream
        const stream = GeminiStream(result.stream as any) // Type casting as our helper expects a Response object typically but we can adapt

        // Actually, our GeminiStream helper expects a Fetch Response (ReadableStream). 
        // The Gemini SDK returns a custom stream structure.
        // We need to write a custom iterator for the SDK stream.

        const encodedStream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder()
                try {
                    for await (const chunk of result.stream) {
                        const text = chunk.text()
                        controller.enqueue(encoder.encode(text))
                    }
                    controller.close()
                } catch (error) {
                    controller.error(error)
                }
            },
        })

        return new StreamingTextResponse(encodedStream)

    } catch (error: any) {
        console.error("Chat error:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

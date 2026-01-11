import { GoogleGenerativeAI } from "@google/generative-ai"
import { GeminiStream } from "@/lib/gemini-stream"
import { StreamingTextResponse } from "@/lib/deepseek-stream" // Reusing text response wrapper
import { addToMemory, queryMemory } from "@/lib/supermemory"

export const runtime = "edge"

export async function POST(req: Request) {
    try {
        const { messages } = await req.json()
        const lastMessage = messages[messages.length - 1].content

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
        // Query Supermemory for relevant context
        let context = ""
        try {
            const memories = await queryMemory(lastMessage)
            if (memories && memories.length > 0) {
                // Adjust based on actual Supermemory response structure, assuming it returns an array of objects with content
                context = memories.map((m: any) => m.content).join("\n---\n")
            }
        } catch (e) {
            console.error("Supermemory query failed", e)
        }

        // Fire-and-forget: Save user message to memory
        addToMemory(lastMessage).catch(err => console.error("Failed to save to memory", err))

        // Construct history from previous messages
        // We inject the context into the system or first message if possible, or just prepend to the latest prompt

        let promptWithContext = lastMessage
        if (context) {
            promptWithContext = `Context from previous conversations/memories:\n${context}\n\nUser Question: ${lastMessage}`
        }

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

        const result = await chat.sendMessageStream(promptWithContext)

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

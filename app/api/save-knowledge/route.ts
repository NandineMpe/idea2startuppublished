
import { NextResponse } from "next/server"
import { addToMemory } from "@/lib/supermemory"

export async function POST(req: Request) {
    try {
        const { content, fileName } = await req.json()

        if (!content) {
            return NextResponse.json({ error: "No content provided" }, { status: 400 })
        }

        // Add to Supermemory
        // We might want to prepend filename/metadata to the content so the AI knows source.
        const structuredContent = `Source: ${fileName || "Uploaded Document"}\n\n${content}`

        const result = await addToMemory(structuredContent)

        if (!result) {
            return NextResponse.json({ error: "Failed to store in memory" }, { status: 500 })
        }

        return NextResponse.json({ success: true, memoryId: result.id })

    } catch (error) {
        console.error("Save knowledge error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

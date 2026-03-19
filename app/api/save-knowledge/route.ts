import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { addToMemory } from "@/lib/supermemory"

export async function POST(req: Request) {
  try {
    const { content, fileName } = await req.json()

    if (!content) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const structuredContent = `Source: ${fileName || "Uploaded Document"}\n\n${content}`
    const result = await addToMemory(structuredContent, user?.id)

    if (!result) {
      return NextResponse.json({ error: "Failed to store in memory" }, { status: 500 })
    }

    return NextResponse.json({ success: true, memoryId: result.id })
  } catch (error) {
    console.error("Save knowledge error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

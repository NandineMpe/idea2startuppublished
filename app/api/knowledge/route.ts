import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { addToMemory, queryMemory } from "@/lib/supermemory"

/**
 * Company-wide semantic memory (Supermemory), scoped per authenticated user.
 * GET ?q= — search memories
 * POST { content: string } — add a memory snippet
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim() || "startup company product strategy"

    const results = await queryMemory(q, user?.id)

    return NextResponse.json({
      results: Array.isArray(results) ? results : [],
    })
  } catch (error) {
    console.error("Knowledge GET error:", error)
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const body = await request.json().catch(() => ({}))
    const content = typeof body.content === "string" ? body.content.trim() : ""
    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 })
    }

    const result = await addToMemory(content, user?.id)
    if (!result) {
      return NextResponse.json({ error: "Failed to store memory" }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: (result as { id?: string }).id })
  } catch (error) {
    console.error("Knowledge POST error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

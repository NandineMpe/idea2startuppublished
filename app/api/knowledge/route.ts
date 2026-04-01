import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { saveVaultKnowledgeEntry, searchVaultKnowledge } from "@/lib/vault-knowledge"

/**
 * Company-wide knowledge layer backed by the configured Obsidian vault.
 * GET ?q= - search vault notes
 * POST { content: string } - add a captured note
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim() || "startup company product strategy"

    const results = await searchVaultKnowledge(q, user?.id)

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
    const title = typeof body.title === "string" ? body.title.trim() : "Quick capture"
    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 })
    }

    const result = await saveVaultKnowledgeEntry({
      content,
      title,
      userId: user?.id,
      folder: "juno/knowledge",
      noteType: "quick_capture",
    })
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Failed to store note in vault" }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: result.path, path: result.path })
  } catch (error) {
    console.error("Knowledge POST error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

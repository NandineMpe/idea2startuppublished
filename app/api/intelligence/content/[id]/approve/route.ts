import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { inngest } from "@/lib/inngest/client"

async function getRow(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data, error } = await supabase
    .from("ai_outputs")
    .select("id, type, content, user_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single()
  if (error || !data) return null
  return data
}

// POST /api/intelligence/content/[id]/approve
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const row = await getRow(supabase, id, user.id)
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { error } = await supabase
      .from("ai_outputs")
      .update({ content: { ...row.content, status: "approved" } })
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) throw error

    // Emit event so platformPoster can pick up technical content
    if (row.type === "content_technical" || row.content?.platform === "technical") {
      await inngest.send({
        name: "juno/content.approved",
        data: {
          userId: user.id,
          contentId: id,
          platform: row.content?.platform ?? "technical",
          type: row.content?.contentType ?? "post_suggestion",
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Content approve error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// DELETE /api/intelligence/content/[id]/approve  → dismiss
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const row = await getRow(supabase, id, user.id)
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { error } = await supabase
      .from("ai_outputs")
      .update({ content: { ...row.content, status: "dismissed" } })
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Content dismiss error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

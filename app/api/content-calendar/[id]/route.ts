import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const ALLOWED_PATCH = new Set([
  "title",
  "body",
  "channel",
  "content_type",
  "scheduled_date",
  "scheduled_time",
  "status",
  "notes",
  "posted_url",
  "angle",
  "target_audience",
])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const updates = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const sanitized: Record<string, unknown> = {}
    for (const key of ALLOWED_PATCH) {
      if (key in updates) sanitized[key] = updates[key]
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("content_calendar")
      .update(sanitized)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("content-calendar PATCH:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error("content-calendar PATCH:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { error } = await supabase.from("content_calendar").delete().eq("id", id).eq("user_id", user.id)

    if (error) {
      console.error("content-calendar DELETE:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("content-calendar DELETE:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

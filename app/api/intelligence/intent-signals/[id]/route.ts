import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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

    const body = (await req.json().catch(() => ({}))) as {
      status?: string
      response_notes?: string | null
    }

    const status = typeof body.status === "string" ? body.status.trim() : ""
    const allowed = new Set(["new", "responded", "converted", "irrelevant"])
    if (!allowed.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const updates: Record<string, unknown> = { status }
    if (status === "responded") {
      updates.responded_at = new Date().toISOString()
    }
    if (body.response_notes !== undefined) {
      updates.response_notes = body.response_notes
    }

    const { data, error } = await supabase
      .from("intent_signals")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("intent-signals PATCH:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error("intent-signals PATCH:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

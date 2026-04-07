import { NextRequest, NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
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
      response_platform?: string | null
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
    } else {
      updates.responded_at = null
    }

    if (body.response_platform !== undefined) {
      const raw = body.response_platform
      if (raw === null || raw === "") {
        updates.response_platform = null
      } else if (typeof raw === "string") {
        updates.response_platform = raw.trim().slice(0, 80) || null
      }
    }

    if (body.response_notes !== undefined) {
      const n = body.response_notes
      updates.response_notes =
        n === null || n === ""
          ? null
          : typeof n === "string"
            ? n.trim().slice(0, 4000) || null
            : null
    }

    const { data, error } = await supabase
      .from("intent_signals")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      return jsonApiError(500, error, "intent-signals PATCH")
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error("intent-signals PATCH:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

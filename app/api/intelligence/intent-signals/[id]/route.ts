import { NextRequest, NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { resolveWorkspaceSelection } from "@/lib/workspaces"

const STATUS_VALUES = new Set(["new", "responded", "converted", "irrelevant"])
const SCORE_FEEDBACK_VALUES = new Set(["too_high", "ok", "too_low"])

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

    const workspace = await resolveWorkspaceSelection(user.id, { useCookieWorkspace: true })
    if (workspace) {
      return NextResponse.json(
        {
          error:
            "This workspace is isolated from your owner-level Reddit inbox. Switch to your company scope to update historical intent signals.",
        },
        { status: 409 },
      )
    }

    const body = (await req.json().catch(() => ({}))) as {
      status?: string
      response_platform?: string | null
      response_notes?: string | null
      score_feedback?: string | null
    }

    const updates: Record<string, unknown> = {}

    if (body.status !== undefined) {
      const status = typeof body.status === "string" ? body.status.trim() : ""
      if (!STATUS_VALUES.has(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      updates.status = status
      if (status === "responded") {
        updates.responded_at = new Date().toISOString()
      } else {
        updates.responded_at = null
      }
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

    if (body.score_feedback !== undefined) {
      const raw = body.score_feedback
      if (raw === null || raw === "") {
        updates.score_feedback = null
        updates.score_feedback_at = null
      } else if (typeof raw === "string" && SCORE_FEEDBACK_VALUES.has(raw.trim())) {
        updates.score_feedback = raw.trim()
        updates.score_feedback_at = new Date().toISOString()
      } else {
        return NextResponse.json({ error: "Invalid score_feedback" }, { status: 400 })
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates" }, { status: 400 })
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

    const { error } = await supabase
      .from("intent_signals")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return jsonApiError(500, error, "intent-signals DELETE")
    }

    return NextResponse.json({ deleted: true })
  } catch (e) {
    console.error("intent-signals DELETE:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

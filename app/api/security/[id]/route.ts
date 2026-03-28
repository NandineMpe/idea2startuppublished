import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const ALLOWED = new Set(["open", "fixed", "false_positive", "accepted_risk"])

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as {
    status?: string
    resolution_notes?: string | null
  }

  const status = body.status
  if (!status || !ALLOWED.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const resolvedAt = status !== "open" ? new Date().toISOString() : null

  const { error } = await supabase
    .from("security_findings")
    .update({
      status,
      resolution_notes: body.resolution_notes ?? null,
      resolved_at: resolvedAt,
    })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error("[api/security PATCH]", error.message)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }

  return NextResponse.json({ updated: true })
}

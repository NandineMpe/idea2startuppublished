import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    extractionId?: string | null
    section?: string
    fieldPath?: string | null
    currentValue?: unknown
    userCorrection?: string
  }
  if (!body.section || typeof body.section !== "string") {
    return NextResponse.json({ error: "section is required" }, { status: 400 })
  }
  const correction = typeof body.userCorrection === "string" ? body.userCorrection.trim() : ""
  if (!correction) {
    return NextResponse.json({ error: "userCorrection is required" }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("user_profile_corrections")
    .insert({
      user_id: user.id,
      extraction_id: body.extractionId ?? null,
      section: body.section.trim(),
      field_path: body.fieldPath ?? null,
      current_value: body.currentValue ?? null,
      user_correction: correction,
    })
    .select("id, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, correction: data })
}

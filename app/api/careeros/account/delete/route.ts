import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const userId = user.id

  // Delete careeros data first (FK order), then auth user.
  // Each delete is best-effort — we continue even if a table has no rows.
  const careerosDeletes = [
    supabaseAdmin.schema("careeros").from("user_ai_feed_items").delete().eq("user_id", userId),
    supabaseAdmin.schema("careeros").from("user_skill_half_life").delete().eq("user_id", userId),
    supabaseAdmin.schema("careeros").from("user_skills").delete().eq("user_id", userId),
    supabaseAdmin.schema("careeros").from("user_documents").delete().eq("user_id", userId),
    supabaseAdmin.schema("careeros").from("user_document_extractions").delete().eq("user_id", userId),
    supabaseAdmin.schema("careeros").from("user_profiles").delete().eq("user_id", userId),
    supabaseAdmin.schema("careeros").from("user_settings").delete().eq("user_id", userId),
  ]

  await Promise.allSettled(careerosDeletes)

  // Delete the Supabase auth user — this cascades to auth.sessions etc.
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}

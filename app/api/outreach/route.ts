import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 30
export const dynamic = "force-dynamic"

async function resolveUserId(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { userId: user.id }
}

/**
 * GET /api/outreach — queue for GTM Motion (newest first).
 * Default: `status=drafted` (cold queue). Use `status=all` to list every status (e.g. dashboard + webhooks).
 */
export async function GET(req: NextRequest) {
  const auth = await resolveUserId(req)
  if ("error" in auth) return auth.error

  const supabase = await createClient()
  const raw = req.nextUrl.searchParams.get("status")
  const status = raw === "all" || raw === "*" ? null : raw ?? "drafted"

  let q = supabase
    .from("outreach_log")
    .select(
      "id, lead_id, lookalike_profile_id, to_name, to_email, to_title, to_company, subject, body, channel, status, sent_at, resend_message_id, opened_at, clicked_at, replied_at, outcome, outcome_notes, scheduled_for, skipped_reason, created_at, updated_at",
    )
    .eq("user_id", auth.userId)

  if (status) {
    q = q.eq("status", status)
  }

  const { data, error } = await q.order("created_at", { ascending: false }).limit(80)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { items: data ?? [] },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  )
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendCareerOSEvent } from "@/lib/careeros/inngest/client"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 15

export async function POST() {
  if (!process.env.INNGEST_EVENT_KEY?.trim()) {
    return NextResponse.json(
      { error: "INNGEST_EVENT_KEY is not set, so queued jobs cannot be sent." },
      { status: 501 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent, error: rErr } = await supabaseAdmin
    .schema("careeros")
    .from("user_career_health_reports")
    .select("id")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .maybeSingle()

  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 })
  }
  if (recent?.id) {
    return NextResponse.json(
      { error: "You already generated a report in the last 24 hours. Try again tomorrow." },
      { status: 429 },
    )
  }

  await sendCareerOSEvent({
    name: "careeros/career-health.generate-for-user",
    data: { user_id: user.id },
  })

  return NextResponse.json({ ok: true, message: "Report generation queued. Check back in a few minutes." })
}

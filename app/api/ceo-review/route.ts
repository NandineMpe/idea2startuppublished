import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { inngest } from "@/lib/inngest/client"
import { JUNO_CEO_REVIEW_REQUESTED } from "@/lib/inngest/event-names"
import { jsonApiError } from "@/lib/api-error-response"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("ceo_reviews")
    .select("id, review_date, review_data, created_at")
    .eq("user_id", user.id)
    .order("review_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    const msg = (error.message ?? "").toLowerCase()
    const missingTable =
      msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find")
    if (missingTable) {
      return NextResponse.json({ review: null })
    }
    console.error("[api/ceo-review GET]", error.message)
    return NextResponse.json({ error: "Failed to load CEO review" }, { status: 500 })
  }

  return NextResponse.json({ review: data ?? null })
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json(
      {
        error: `INNGEST_EVENT_KEY not set — add from Inngest dashboard (Keys) so the app can send ${JUNO_CEO_REVIEW_REQUESTED}.`,
      },
      { status: 501 },
    )
  }

  try {
    const { ids } = await inngest.send({
      name: JUNO_CEO_REVIEW_REQUESTED,
      data: { userId: user.id },
    })
    return NextResponse.json({
      ok: true,
      triggered: true,
      eventName: JUNO_CEO_REVIEW_REQUESTED,
      eventIds: ids,
    })
  } catch (e) {
    return jsonApiError(503, e, "ceo-review POST inngest.send")
  }
}

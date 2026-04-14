import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { inngest } from "@/lib/inngest/client"
import { CONTENT_FEED_MANUAL_DIGEST_REQUESTED } from "@/lib/inngest/event-names"
import { jsonApiError } from "@/lib/api-error-response"

export async function GET() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Audit AI digest also uses content_briefings but stores JSON in `summary`. Never surface that row as the feed briefing.
  const { data, error } = await supabase
    .from("content_briefings")
    .select("id, generated_at, angle, summary, top_hook, connections, story_count, breaking_count")
    .eq("user_id", auth.user.id)
    .not("id", "like", "audit-digest:%")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    const msg = (error.message ?? "").toLowerCase()
    if (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find")) {
      return NextResponse.json({ briefing: null })
    }
    return jsonApiError(500, error, "content-feed briefing GET")
  }

  return NextResponse.json({ briefing: data ?? null })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json({ error: "INNGEST_EVENT_KEY not set." }, { status: 501 })
  }

  let angle = ""
  try {
    const body = (await req.json()) as { angle?: string }
    angle = typeof body.angle === "string" ? body.angle.trim().slice(0, 120) : ""
  } catch {
    angle = ""
  }

  try {
    const { ids } = await inngest.send({
      name: CONTENT_FEED_MANUAL_DIGEST_REQUESTED,
      data: { userId: auth.user.id, angle: angle || undefined },
    })
    return NextResponse.json({ ok: true, eventIds: ids })
  } catch (e) {
    return jsonApiError(503, e, "content-feed briefing POST")
  }
}

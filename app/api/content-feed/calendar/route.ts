import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { jsonApiError } from "@/lib/api-error-response"

function weekBounds(today = new Date()) {
  const d = new Date(today)
  const day = d.getDay()
  const diffToMonday = (day + 6) % 7
  d.setDate(d.getDate() - diffToMonday)
  d.setHours(0, 0, 0, 0)
  const start = new Date(d)
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export async function GET() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { start, end } = weekBounds()
  const { data, error } = await supabase
    .from("content_calendar")
    .select("id, title, body, channel, content_type, scheduled_date, status, source_ref")
    .eq("user_id", auth.user.id)
    .gte("scheduled_date", start)
    .lte("scheduled_date", end)
    .order("scheduled_date", { ascending: true })
  if (error) return jsonApiError(500, error, "content-feed calendar GET")
  return NextResponse.json({ weekStart: start, weekEnd: end, items: data ?? [] })
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let body: { storyId?: string; date?: string; title?: string }
  try {
    body = (await req.json()) as { storyId?: string; date?: string; title?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!body.storyId || !body.date) return NextResponse.json({ error: "storyId and date required" }, { status: 400 })
  const { error } = await supabase.from("content_calendar").insert({
    user_id: auth.user.id,
    title: body.title || "Content feed story",
    body: body.title || "Story from content intelligence feed",
    channel: "tiktok",
    content_type: "post",
    scheduled_date: body.date,
    status: "draft",
    source: "content-feed",
    source_ref: body.storyId,
  })
  if (error) return jsonApiError(500, error, "content-feed calendar PUT")
  return NextResponse.json({ ok: true })
}

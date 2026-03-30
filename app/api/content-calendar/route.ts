import { NextRequest, NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"

function weekRangeISO(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(12, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    let startDate = url.searchParams.get("start")
    let endDate = url.searchParams.get("end")
    if (!startDate || !endDate) {
      const w = weekRangeISO()
      if (!startDate) startDate = w.start
      if (!endDate) endDate = w.end
    }

    const statusFilter = url.searchParams.get("status")

    let scheduledQuery = supabase
      .from("content_calendar")
      .select("*")
      .eq("user_id", user.id)
      .not("scheduled_date", "is", null)
      .gte("scheduled_date", startDate!)
      .lte("scheduled_date", endDate!)
      .order("scheduled_date", { ascending: true })
      .order("created_at", { ascending: true })

    if (statusFilter) scheduledQuery = scheduledQuery.eq("status", statusFilter)

    const { data: scheduled, error: schedErr } = await scheduledQuery
    if (schedErr) {
      return jsonApiError(500, schedErr, "content-calendar GET scheduled")
    }

    let unscheduledQuery = supabase
      .from("content_calendar")
      .select("*")
      .eq("user_id", user.id)
      .is("scheduled_date", null)
      .neq("status", "skipped")
      .order("created_at", { ascending: false })

    if (statusFilter) unscheduledQuery = unscheduledQuery.eq("status", statusFilter)

    const { data: unscheduled, error: unsErr } = await unscheduledQuery
    if (unsErr) {
      return jsonApiError(500, unsErr, "content-calendar GET unscheduled")
    }

    return NextResponse.json({
      scheduled: scheduled ?? [],
      unscheduled: unscheduled ?? [],
      range: { start: startDate, end: endDate },
    })
  } catch (e) {
    console.error("content-calendar GET:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as {
      title?: string | null
      body?: string
      channel?: string
      content_type?: string
      scheduled_date?: string | null
      scheduled_time?: string | null
      angle?: string | null
      notes?: string | null
    }

    const text = typeof body.body === "string" ? body.body.trim() : ""
    if (!text) {
      return NextResponse.json({ error: "body is required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("content_calendar")
      .insert({
        user_id: user.id,
        title: body.title ?? null,
        body: text,
        channel: body.channel ?? "linkedin",
        content_type: body.content_type ?? "post",
        scheduled_date: body.scheduled_date ?? null,
        scheduled_time: body.scheduled_time ?? null,
        status: "draft",
        source: "manual",
        angle: body.angle ?? null,
        notes: body.notes ?? null,
      })
      .select()
      .single()

    if (error) {
      return jsonApiError(500, error, "content-calendar POST")
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error("content-calendar POST:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

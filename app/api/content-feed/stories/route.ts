import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { jsonApiError } from "@/lib/api-error-response"
import type { ContentStatus } from "@/lib/content-intelligence/types"

const VALID_STATUS: ContentStatus[] = ["new", "queued", "filmed", "skipped"]

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const pillar = url.searchParams.get("pillar")
  const status = url.searchParams.get("status")
  const minScore = Number(url.searchParams.get("minScore") || "0")
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || "40")))

  let query = supabase
    .from("content_stories")
    .select(
      "id, briefing_id, title, url, source, tier, published_at, pillar, urgency, content_score, hook, key_quote, why_it_matters, status, connected_topics, named_people, named_companies, named_numbers",
    )
    .eq("user_id", auth.user.id)
    .gte("content_score", Number.isFinite(minScore) ? minScore : 0)
    .order("content_score", { ascending: false })
    .limit(limit)

  if (pillar && pillar !== "all") query = query.eq("pillar", pillar)
  if (status && status !== "all") query = query.eq("status", status)

  const { data, error } = await query
  if (error) {
    const msg = (error.message ?? "").toLowerCase()
    if (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find")) {
      return NextResponse.json({ stories: [] })
    }
    return jsonApiError(500, error, "content-feed stories GET")
  }
  return NextResponse.json({ stories: data ?? [] })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { id?: string; status?: ContentStatus }
  try {
    body = (await req.json()) as { id?: string; status?: ContentStatus }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.id || !body.status || !VALID_STATUS.includes(body.status)) {
    return NextResponse.json({ error: "id and valid status required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("content_stories")
    .update({ status: body.status })
    .eq("id", body.id)
    .eq("user_id", auth.user.id)

  if (error) return jsonApiError(500, error, "content-feed stories PATCH")
  return NextResponse.json({ ok: true })
}

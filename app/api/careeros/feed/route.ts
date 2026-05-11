import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? 20)))
  const cursor = url.searchParams.get("cursor")
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  let q = supabase
    .schema("careeros")
    .from("user_ai_feed_items")
    .select("id,feed_type,feed_at,title,item_payload,is_read,dismissed_at,relevance_score,personalised_note,source_attribution")
    .eq("user_id", user.id)
    .is("dismissed_at", null)
    .gte("feed_at", cutoff)
    .order("feed_at", { ascending: false })
    .limit(limit)
  if (cursor) q = q.lt("feed_at", cursor)
  const { data, error } = await q
  if (error) throw error
  const nextCursor = data && data.length === limit ? String(data[data.length - 1]?.feed_at ?? "") : null
  return NextResponse.json({ items: data ?? [], next_cursor: nextCursor })
}

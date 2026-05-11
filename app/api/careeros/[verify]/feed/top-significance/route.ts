import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request, context: { params: Promise<{ verify: string }> }) {
  const { verify } = await context.params
  if (verify !== "_verify") return NextResponse.json({ error: "Not found" }, { status: 404 })
  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token || token !== process.env.VERIFY_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? 15)))
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("feed_items_enriched")
    .select(
      "id,enriched_summary,entity_type,entities,affected_functions,affected_skills,affected_seniority_levels,significance_score,enrichment_completed_at,feed_source_items!inner(source_key,title,url,published_at)",
    )
    .gte("enrichment_completed_at", since)
    .order("significance_score", { ascending: false })
    .limit(limit)
  if (error) throw error
  return NextResponse.json({
    window: "last_7_days",
    top_significance_items: data ?? [],
  })
}

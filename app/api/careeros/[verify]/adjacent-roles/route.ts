import { NextResponse } from "next/server"
import { ADJACENT_ROLES_SOURCE_DATASET_VERSION } from "@/lib/careeros/market/adjacent-version"
import { getAdjacentRolesForUser } from "@/lib/careeros/market/adjacent-roles"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(
  request: Request,
  context: { params: Promise<{ verify: string }> },
) {
  const { verify } = await context.params
  if (verify !== "_verify") return NextResponse.json({ error: "Not found" }, { status: 404 })

  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token || token !== process.env.VERIFY_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = url.searchParams.get("user_id") ?? undefined

  const { data: rows, error } = await supabaseAdmin
    .schema("careeros")
    .from("market_adjacent_roles")
    .select("source_soc_code,target_soc_code,rank_position,similarity_score,updated_at")
    .eq("source_dataset_version", ADJACENT_ROLES_SOURCE_DATASET_VERSION)
    .limit(20000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sourceSocs = new Set<string>()
  let oldest = ""
  let newest = ""
  for (const r of rows ?? []) {
    sourceSocs.add(String(r.source_soc_code))
    const ts = String(r.updated_at ?? "")
    if (!oldest || ts < oldest) oldest = ts
    if (!newest || ts > newest) newest = ts
  }

  const { data: runs } = await supabaseAdmin
    .schema("careeros")
    .from("cache_refresh_runs")
    .select("started_at,completed_at,status,rows_processed,rows_inserted,run_stats")
    .eq("dataset_key", "market_adjacent_roles")
    .order("started_at", { ascending: false })
    .limit(5)

  return NextResponse.json({
    cache_health: {
      source_socs_covered: sourceSocs.size,
      rows_total: (rows ?? []).length,
      oldest_refresh: oldest || null,
      newest_refresh: newest || null,
      dataset_version: ADJACENT_ROLES_SOURCE_DATASET_VERSION,
    },
    sample: (rows ?? []).slice(0, 10),
    sample_query: userId ? await getAdjacentRolesForUser(userId) : null,
    recent_refresh_runs: runs ?? [],
  })
}

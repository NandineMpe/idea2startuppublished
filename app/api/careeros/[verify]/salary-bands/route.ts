/**
 * GET /api/careeros/_verify/salary-bands?token=&user_id=
 * Module 2.2 diagnostic for cache coverage + sample user query.
 */
import { NextResponse } from "next/server"
import { getSalaryBandsForUser } from "@/lib/careeros/market/salary-bands"
import { SALARY_SOURCE_DATASET_VERSION } from "@/lib/careeros/market/salary-version"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(
  request: Request,
  context: { params: Promise<{ verify: string }> },
) {
  const { verify } = await context.params
  if (verify !== "_verify") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token || token !== process.env.VERIFY_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = url.searchParams.get("user_id")?.trim() || null

  const { count: rowsCount, error: rowsErr } = await supabaseAdmin
    .schema("careeros")
    .from("market_salary_bands")
    .select("*", { count: "exact", head: true })
    .eq("source_dataset_version", SALARY_SOURCE_DATASET_VERSION)

  if (rowsErr) {
    return NextResponse.json({ error: rowsErr.message }, { status: 500 })
  }

  const { data: combos, error: combosErr } = await supabaseAdmin
    .schema("careeros")
    .from("market_salary_bands")
    .select("onet_soc_code,region_code,updated_at")
    .eq("source_dataset_version", SALARY_SOURCE_DATASET_VERSION)
    .limit(5000)

  if (combosErr) {
    return NextResponse.json({ error: combosErr.message }, { status: 500 })
  }

  const uniqueCombos = new Set<string>()
  let newestRefresh = ""
  let oldestRefresh = ""
  for (const row of combos ?? []) {
    uniqueCombos.add(`${row.onet_soc_code}:${row.region_code}`)
    const ts = String(row.updated_at ?? "")
    if (!newestRefresh || ts > newestRefresh) newestRefresh = ts
    if (!oldestRefresh || ts < oldestRefresh) oldestRefresh = ts
  }

  let sample_query: unknown = null
  if (userId) {
    sample_query = await getSalaryBandsForUser(userId)
  }

  const { data: recentRuns } = await supabaseAdmin
    .schema("careeros")
    .from("cache_refresh_runs")
    .select("started_at,completed_at,status,rows_inserted,rows_updated")
    .eq("dataset_key", "market_salary_bands")
    .order("started_at", { ascending: false })
    .limit(5)

  return NextResponse.json({
    cache_health: {
      dataset_version: SALARY_SOURCE_DATASET_VERSION,
      total_rows: rowsCount ?? 0,
      populated_combinations: uniqueCombos.size,
      oldest_refresh: oldestRefresh || null,
      newest_refresh: newestRefresh || null,
    },
    sample_query,
    recent_refresh_runs: recentRuns ?? [],
  })
}

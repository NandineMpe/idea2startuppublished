import { NextResponse } from "next/server"
import {
  getTopDecliningSkillsGlobal,
  getTopRisingSkillsGlobal,
  SKILL_VELOCITY_DATASET_VERSION,
} from "@/lib/careeros/market/skill-velocity"
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

  const [rising, declining] = await Promise.all([
    getTopRisingSkillsGlobal("M360", 10),
    getTopDecliningSkillsGlobal("M720", 10),
  ])

  const { data: rows, error } = await supabaseAdmin
    .schema("careeros")
    .from("market_skill_velocity")
    .select("canonical_skill_key,region_code,window_code,window_end,updated_at")
    .eq("source_dataset_version", SKILL_VELOCITY_DATASET_VERSION)
    .limit(20000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const uniqueSkills = new Set<string>()
  const regions = new Set<string>()
  const windows = new Set<string>()
  let oldest = ""
  let newest = ""
  for (const r of rows ?? []) {
    uniqueSkills.add(String(r.canonical_skill_key))
    regions.add(String(r.region_code))
    windows.add(String(r.window_code))
    const ts = String(r.updated_at ?? r.window_end ?? "")
    if (!oldest || ts < oldest) oldest = ts
    if (!newest || ts > newest) newest = ts
  }

  const { count: synCount } = await supabaseAdmin
    .schema("careeros")
    .from("skill_synonyms")
    .select("*", { count: "exact", head: true })

  const { data: recentRuns } = await supabaseAdmin
    .schema("careeros")
    .from("cache_refresh_runs")
    .select("started_at,completed_at,status,run_stats,rows_inserted,rows_updated")
    .eq("dataset_key", "market_skill_velocity")
    .order("started_at", { ascending: false })
    .limit(5)

  const now = Date.now()
  const weeklyThresholdMs = 8 * 24 * 60 * 60 * 1000
  const successfulStatuses = new Set(["completed", "completed_with_errors"])
  const recentSuccessful = (recentRuns ?? []).find((r) =>
    successfulStatuses.has(String(r.status ?? "")),
  )
  const recentSuccessfulStartedAt = recentSuccessful?.started_at
    ? String(recentSuccessful.started_at)
    : null
  const weeklyHealthy =
    recentSuccessfulStartedAt != null &&
    now - Date.parse(recentSuccessfulStartedAt) <= weeklyThresholdMs

  const expectedTrendSkills = new Set([
    "ai-llm",
    "ai-agents",
    "artificial-intelligence",
    "machine-learning",
    "prompt-engineering",
  ])
  const risingTopKeys = (rising ?? []).map((r) => String(r.canonical_skill_key))
  const matchedTrendSkills = risingTopKeys.filter((k) => expectedTrendSkills.has(k))
  const trendSanityPass = matchedTrendSkills.length >= 3

  return NextResponse.json({
    cache_health: {
      total_skills_tracked_global: uniqueSkills.size,
      regions_covered: regions.size,
      windows_computed: windows.size,
      cells_populated: (rows ?? []).length,
      oldest_refresh: oldest || null,
      newest_refresh: newest || null,
    },
    top_rising_global_m360: rising,
    top_declining_global_m720: declining,
    synonym_table_size: synCount ?? 0,
    weekly_reliability: {
      cron_expression: "0 14 * * 0",
      healthy_within_8_days: Boolean(weeklyHealthy),
      last_successful_run_started_at: recentSuccessfulStartedAt,
      acceptable_statuses: [...successfulStatuses],
    },
    trend_sanity: {
      pass: trendSanityPass,
      expected_keywords: [...expectedTrendSkills],
      matched_in_top_rising: matchedTrendSkills,
      required_min_matches: 3,
    },
    recent_refresh_runs: recentRuns ?? [],
  })
}

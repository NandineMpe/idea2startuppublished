import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { HALF_LIFE_METHODOLOGY_VERSION } from "@/lib/careeros/skills/half-life-compute"

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

  const [
    { count: exposureCount, error: expErr },
    { data: exposureByCategory, error: catErr },
    { count: halfLifeCount, error: hlErr },
    { data: recentHalfLife, error: recentErr },
    { data: portfolioSample, error: sampleErr },
    { data: recentRefresh, error: refreshErr },
  ] = await Promise.all([
    supabaseAdmin
      .schema("careeros")
      .from("skill_ai_exposure_scores")
      .select("*", { count: "exact", head: true }),
    supabaseAdmin
      .schema("careeros")
      .from("skill_ai_exposure_scores")
      .select("exposure_category")
      .limit(5000),
    supabaseAdmin
      .schema("careeros")
      .from("user_skill_half_life")
      .select("*", { count: "exact", head: true }),
    supabaseAdmin
      .schema("careeros")
      .from("user_skill_half_life")
      .select("status,confidence,calculated_for_date,methodology_version")
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .schema("careeros")
      .from("user_skill_half_life")
      .select("user_id,status,confidence,half_life_months,calculated_for_date")
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .schema("careeros")
      .from("generation_runs")
      .select("created_at,status,input_data_version")
      .eq("workflow_name", "careeros/skills.compute-half-life-for-user")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  if (expErr || catErr || hlErr || recentErr || sampleErr || refreshErr) {
    return NextResponse.json(
      {
        error: "Query failed",
        details: [expErr, catErr, hlErr, recentErr, sampleErr, refreshErr]
          .filter(Boolean)
          .map((e) => e!.message),
      },
      { status: 500 },
    )
  }

  // Compute category breakdown
  const categoryBreakdown: Record<string, number> = {}
  for (const row of exposureByCategory ?? []) {
    const cat = String(row.exposure_category ?? "unknown")
    categoryBreakdown[cat] = (categoryBreakdown[cat] ?? 0) + 1
  }

  // Compute status breakdown from recent half-life rows
  const statusBreakdown: Record<string, number> = {}
  for (const row of recentHalfLife ?? []) {
    const st = String(row.status ?? "null")
    statusBreakdown[st] = (statusBreakdown[st] ?? 0) + 1
  }

  return NextResponse.json({
    exposure_scores_health: {
      total_scored: exposureCount ?? 0,
      by_category: categoryBreakdown,
    },
    computation_health: {
      total_half_life_rows: halfLifeCount ?? 0,
      recent_status_breakdown: statusBreakdown,
      methodology_versions_observed: [
        ...new Set((recentHalfLife ?? []).map((r) => String(r.methodology_version ?? "unknown"))),
      ],
    },
    user_portfolio_sample: (portfolioSample ?? []).map((r) => ({
      status: r.status,
      confidence: r.confidence,
      half_life_months: r.half_life_months,
      calculated_for_date: r.calculated_for_date,
    })),
    methodology_version_in_production: HALF_LIFE_METHODOLOGY_VERSION,
    last_quarterly_exposure_refresh:
      (recentRefresh ?? []).length > 0 ? recentRefresh![0].created_at : null,
  })
}

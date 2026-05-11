import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: skillRows, error } = await supabase
    .schema("careeros")
    .from("user_skills")
    .select(
      `id, skill_name, canonical_skill_key, current_status,
       user_skill_half_life:current_half_life_id (
         status, confidence, half_life_months,
         half_life_range_low_months, half_life_range_high_months,
         calculated_for_date, factors_payload, velocity_score_used,
         exposure_score_used, exposure_category_used
       )`,
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("skill_name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const skills = (skillRows ?? []).map((row) => {
    const hlRaw = row.user_skill_half_life
    const hl =
      hlRaw && typeof hlRaw === "object" && !Array.isArray(hlRaw)
        ? (hlRaw as Record<string, unknown>)
        : null

    return {
      id: row.id,
      skill_name: row.skill_name,
      canonical_skill_key: row.canonical_skill_key,
      current_status: row.current_status ?? hl?.status ?? null,
      half_life_months: hl?.half_life_months ?? null,
      half_life_range_low_months: hl?.half_life_range_low_months ?? null,
      half_life_range_high_months: hl?.half_life_range_high_months ?? null,
      confidence: hl?.confidence ?? null,
      calculated_for_date: hl?.calculated_for_date ?? null,
    }
  })

  const byStatus: Record<string, number> = {
    rising: 0,
    stable: 0,
    declining: 0,
    "at-risk": 0,
  }
  for (const s of skills) {
    const st = String(s.current_status ?? "")
    if (st in byStatus) {
      byStatus[st] = (byStatus[st] ?? 0) + 1
    }
  }

  const dates = skills
    .map((s) => s.calculated_for_date)
    .filter((d): d is string => typeof d === "string")
    .sort()
    .reverse()
  const lastRefreshed = dates[0] ?? null

  return NextResponse.json({
    skills,
    last_refreshed: lastRefreshed,
    methodology_version: "v1",
    by_status: byStatus,
  })
}

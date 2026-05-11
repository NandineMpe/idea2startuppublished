import { createClient } from "@supabase/supabase-js"
import { getPersonalSkillVelocityForUser } from "../lib/careeros/market/skill-velocity"

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  const limit = Math.max(1, Number(process.argv[2] ?? "5"))
  const sb = createClient(url, key)

  const { data: candidates, error } = await sb
    .schema("careeros")
    .from("user_skills")
    .select("user_id")
    .eq("is_active", true)
    .limit(5000)
  if (error) throw error

  const uniqueUserIds = [...new Set((candidates ?? []).map((r) => String(r.user_id)))].slice(0, limit)
  const checks: Array<Record<string, unknown>> = []
  for (const userId of uniqueUserIds) {
    const result = await getPersonalSkillVelocityForUser(userId, "M360")
    checks.push({
      user_id: userId,
      status: result.status,
      rising_count: "rising" in result ? result.rising.length : 0,
      declining_count: "declining" in result ? result.declining.length : 0,
    })
  }

  const readyCount = checks.filter((c) => c.status === "ready").length
  console.log(
    JSON.stringify(
      {
        requested_limit: limit,
        candidates_found: uniqueUserIds.length,
        ready_count: readyCount,
        pass_for_five_profiles: uniqueUserIds.length >= 5 && readyCount >= 5,
        checks,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

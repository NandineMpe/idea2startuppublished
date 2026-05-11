import { createClient } from "@supabase/supabase-js"
import { getAdjacentRolesForUser } from "../lib/careeros/market/adjacent-roles"

const GENERIC_TERMS = new Set([
  "communication",
  "teamwork",
  "leadership",
  "problem solving",
  "problem-solving",
  "critical thinking",
  "critical-thinking",
  "time management",
  "time-management",
  "domain expertise",
  "domain-expertise",
])

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  const sb = createClient(url, key)

  const { data: users, error } = await sb
    .schema("careeros")
    .from("user_profiles")
    .select("user_id")
    .not("onet_soc_code", "is", null)
    .limit(10)
  if (error) throw error

  const checks: Array<Record<string, unknown>> = []
  let failures = 0
  for (const u of users ?? []) {
    const userId = String(u.user_id)
    const res = await getAdjacentRolesForUser(userId)
    if (res.status !== "ready") {
      failures += 1
      checks.push({ user_id: userId, status: res.status, pass: false })
      continue
    }
    const sample = res.items.slice(0, 5)
    const missingCount = sample.filter((i) => (i.bridge_skill_keys ?? []).length >= 3).length
    const genericHits = sample.flatMap((i) =>
      (i.bridge_skill_keys ?? []).filter((k) => GENERIC_TERMS.has(String(k).toLowerCase())),
    )
    const pass = missingCount >= 3 && genericHits.length === 0
    if (!pass) failures += 1
    checks.push({
      user_id: userId,
      status: res.status,
      recommendations_checked: sample.length,
      actionable_recs: missingCount,
      generic_hits: genericHits,
      pass,
    })
  }

  console.log(
    JSON.stringify(
      {
        users_checked: checks.length,
        passed: checks.length - failures,
        failed: failures,
        pass: failures === 0 && checks.length >= 10,
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

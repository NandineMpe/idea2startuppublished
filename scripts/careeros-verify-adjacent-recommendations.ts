import { randomUUID } from "crypto"
import { createClient } from "@supabase/supabase-js"
import { getAdjacentRolesForUser } from "../lib/careeros/market/adjacent-roles"

const TARGET_USERS = 10
const EMAIL_PREFIX = "careeros-test-adjacent+"
const ENGINEER_SOC = "15-1252.00"
const ENGINEER_TITLE = "Software Engineer"
const FORBIDDEN_FOR_ENGINEER = new Set([
  "11-2021.00", // Marketing Managers
  "41-3031.03", // Financial Services Sales Agents
])

async function ensureUsers(sb: ReturnType<typeof createClient>): Promise<string[]> {
  const existing: string[] = []
  let page = 1
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const users = data?.users ?? []
    for (const u of users) {
      const email = u.email ?? ""
      if (email.startsWith(EMAIL_PREFIX)) existing.push(String(u.id))
    }
    if (users.length < 200) break
    page += 1
  }

  const ids = [...existing]
  for (let i = ids.length; i < TARGET_USERS; i++) {
    const email = `${EMAIL_PREFIX}${i + 1}@juno.local`
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: `Adj!${randomUUID()}`,
      email_confirm: true,
      user_metadata: { source: "careeros-adjacent-fixture" },
    })
    if (error) throw error
    if (data.user?.id) ids.push(String(data.user.id))
  }
  return ids.slice(0, TARGET_USERS)
}

function isEngineer(profile: { onet_soc_code: string | null; current_role_title: string | null }): boolean {
  if (profile.onet_soc_code === ENGINEER_SOC) return true
  const t = (profile.current_role_title ?? "").toLowerCase()
  return t.includes("engineer")
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  const sb = createClient(url, key)

  const userIds = await ensureUsers(sb)

  const profileRows = userIds.map((userId, i) => ({
    user_id: userId,
    current_role_title: i < 8 ? ENGINEER_TITLE : "Data Analyst",
    target_role_title: i < 8 ? "ML Engineer" : "Senior Data Analyst",
    location_region_code: i % 2 === 0 ? "IE" : "US",
    years_experience: 2 + i,
    onet_soc_code: i < 8 ? ENGINEER_SOC : "15-2051.02",
  }))
  const { error: profileErr } = await sb
    .schema("careeros")
    .from("user_profiles")
    .upsert(profileRows, { onConflict: "user_id" })
  if (profileErr) throw profileErr

  const checks: Array<Record<string, unknown>> = []
  let fails = 0

  for (const p of profileRows) {
    const result = await getAdjacentRolesForUser(p.user_id)
    const itemSocs =
      result.status === "ready" ? result.items.map((r) => r.target_soc_code) : []
    const forbiddenHit = isEngineer({
      onet_soc_code: p.onet_soc_code,
      current_role_title: p.current_role_title,
    })
      ? itemSocs.filter((soc) => FORBIDDEN_FOR_ENGINEER.has(soc))
      : []
    const pass = result.status === "ready" && forbiddenHit.length === 0 && itemSocs.length > 0
    if (!pass) fails += 1
    checks.push({
      user_id: p.user_id,
      source_soc: p.onet_soc_code,
      status: result.status,
      recommendation_count: itemSocs.length,
      forbidden_hits: forbiddenHit,
      pass,
    })
  }

  console.log(
    JSON.stringify(
      {
        users_checked: checks.length,
        passed: checks.length - fails,
        failed: fails,
        sniff_test_pass: fails === 0 && checks.length >= TARGET_USERS,
        forbidden_for_engineer: [...FORBIDDEN_FOR_ENGINEER],
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

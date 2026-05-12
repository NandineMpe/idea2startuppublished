import { createClient } from "@supabase/supabase-js"
import { getAdjacentRolesForUser } from "../lib/careeros/market/adjacent-roles"
import { getFrontierRolesForUser } from "../lib/careeros/market/frontier-roles"

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const required = Math.max(1, Number(process.argv[2] ?? "5"))
  const sb = createClient(url, key)

  const { data: profiles, error } = await sb
    .schema("careeros")
    .from("user_profiles")
    .select("user_id,onet_soc_code,location_region_code")
    .not("onet_soc_code", "is", null)
    .limit(5000)
  if (error) throw error

  const ids = [...new Set((profiles ?? []).map((r) => String(r.user_id)))].slice(0, required)
  const checks: Array<Record<string, unknown>> = []
  for (const userId of ids) {
    const adjacent = await getAdjacentRolesForUser(userId)
    const frontier = await getFrontierRolesForUser(userId, { adjacent })
    const withExample =
      frontier.status === "ready"
        ? frontier.items.filter((x) => Boolean(x.examplePostingUrl)).length
        : 0
    checks.push({
      user_id: userId,
      frontier_status: frontier.status,
      frontier_items: frontier.status === "ready" ? frontier.items.length : 0,
      frontier_with_example: withExample,
    })
  }

  const readyUsers = checks.filter((c) => c.frontier_status === "ready")
  const pass = ids.length >= required && readyUsers.length >= required

  console.log(
    JSON.stringify(
      {
        requested_limit: required,
        candidates_found: ids.length,
        ready_count: readyUsers.length,
        pass_for_five_profiles: pass,
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

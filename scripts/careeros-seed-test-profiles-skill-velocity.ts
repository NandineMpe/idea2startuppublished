import { randomUUID } from "crypto"
import { createClient } from "@supabase/supabase-js"

const TEST_EMAIL_PREFIX = "careeros-test-velocity+"
const TARGET_COUNT = 5

const SEED_SKILLS = [
  { name: "Python", key: "python" },
  { name: "JavaScript", key: "javascript" },
  { name: "TypeScript", key: "typescript" },
  { name: "SQL", key: "sql" },
  { name: "AWS", key: "aws" },
  { name: "Docker", key: "docker" },
  { name: "Machine Learning", key: "machine-learning" },
  { name: "Data Analysis", key: "data-analysis" },
]

async function ensureTestUsers(sb: ReturnType<typeof createClient>) {
  const existing: string[] = []
  let page = 1
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const users = data?.users ?? []
    for (const u of users) {
      const email = u.email ?? ""
      if (email.startsWith(TEST_EMAIL_PREFIX)) existing.push(String(u.id))
    }
    if (!users.length || users.length < 200) break
    page += 1
  }

  const ids = [...existing]
  for (let i = ids.length; i < TARGET_COUNT; i++) {
    const email = `${TEST_EMAIL_PREFIX}${i + 1}@juno.local`
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: `Test!${randomUUID()}`,
      email_confirm: true,
      user_metadata: { source: "careeros-test-fixture" },
    })
    if (error) throw error
    if (data.user?.id) ids.push(String(data.user.id))
  }
  return ids.slice(0, TARGET_COUNT)
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  const sb = createClient(url, key)

  const userIds = await ensureTestUsers(sb)
  const profiles = userIds.map((userId, i) => ({
    user_id: userId,
    current_role_title: "Software Engineer",
    target_role_title: i % 2 === 0 ? "ML Engineer" : "Senior Software Engineer",
    location_region_code: i % 2 === 0 ? "IE" : "US",
    years_experience: 3 + i,
    onet_soc_code: "15-1252.00",
  }))

  const { error: profileErr } = await sb
    .schema("careeros")
    .from("user_profiles")
    .upsert(profiles, { onConflict: "user_id" })
  if (profileErr) throw profileErr

  const { error: deleteErr } = await sb
    .schema("careeros")
    .from("user_skills")
    .delete()
    .in("user_id", userIds)
  if (deleteErr) throw deleteErr

  const now = new Date().toISOString()
  const skills = userIds.flatMap((userId) =>
    SEED_SKILLS.map((skill) => ({
      id: randomUUID(),
      user_id: userId,
      canonical_skill_key: skill.key,
      skill_name: skill.name,
      proficiency_score: 65,
      proficiency_band: "mid",
      evidence_payload: [
        {
          source: "seed",
          note: "module 2.3 verification fixture",
        },
      ],
      source_type: "manual",
      is_active: true,
      onet_mapping_payload: {},
      created_at: now,
      updated_at: now,
    })),
  )
  const { error: skillsErr } = await sb.schema("careeros").from("user_skills").insert(skills)
  if (skillsErr) throw skillsErr

  console.log(
    JSON.stringify({
      users_seeded: userIds.length,
      skills_per_user: SEED_SKILLS.length,
      total_skill_rows: skills.length,
      user_ids: userIds,
    }),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

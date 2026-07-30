const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

function loadEnv() {
  for (const f of [".env.vercel.production", ".env.vercel.preview"]) {
    const p = path.join(__dirname, "..", f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  }
}

async function main() {
  loadEnv()
  const userId = process.argv[2] || "961be40a-f699-468b-82ff-45d15e5eb2b4"
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const profile = await sb
    .schema("careeros")
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  console.log("profile:", profile.error?.message || profile.data)

  const settings = await sb
    .schema("careeros")
    .from("user_settings")
    .select("onboarding_state")
    .eq("user_id", userId)
    .maybeSingle()
  const m11 = settings.data?.onboarding_state?.module_1_1
  const m12 = m11?.module_1_2
  console.log("module_1_2:", JSON.stringify(m12, null, 2))

  const extract = await sb
    .schema("careeros")
    .from("user_document_extractions")
    .select("id,parser_name,extraction_method,parsed_payload,created_at")
    .eq("user_id", userId)
    .eq("parser_name", "careeros-profile-extract")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (extract.error) console.log("profile-extract err:", extract.error.message)
  else {
    const p = extract.data?.parsed_payload
    console.log("profile-extract id:", extract.data?.id)
    console.log("method:", extract.data?.extraction_method)
    console.log("skills count:", p?.skills?.length)
    console.log("past_roles count:", p?.past_roles?.length)
    console.log("current_role:", p?.current_role)
    console.log("sample skills:", p?.skills?.slice(0, 3))
  }

  const onboardingEx = await sb
    .schema("careeros")
    .from("user_document_extractions")
    .select("id,user_document_id,parsed_payload")
    .eq("user_id", userId)
    .eq("parser_name", "careeros-onboarding")
    .eq("is_current", true)
  for (const row of onboardingEx.data ?? []) {
    const text = row.parsed_payload?.plain_text
    console.log(
      "onboarding extraction",
      row.id,
      "plain_text len:",
      typeof text === "string" ? text.length : 0,
      "preview:",
      typeof text === "string" ? text.slice(0, 120).replace(/\n/g, " ") : null,
    )
  }

  const skills = await sb
    .schema("careeros")
    .from("user_skills")
    .select("skill_name,source_type,is_active,is_placeholder")
    .eq("user_id", userId)
  console.log("skills:", skills.error?.message || skills.data)

  const runs = await sb
    .schema("careeros")
    .from("generation_runs")
    .select("status,error_message,created_at")
    .eq("user_id", userId)
    .eq("workflow_name", "careeros/profile.extract")
    .order("created_at", { ascending: false })
    .limit(3)
  console.log("generation_runs:", runs.error?.message || runs.data)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

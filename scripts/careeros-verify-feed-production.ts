import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"

function loadEnvFile(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.vercel.production"))
  const verifyToken = process.env.VERIFY_TOKEN
  const baseUrl = process.env.CAREEROS_SMOKE_BASE_URL || "https://usejuno-ai.com"
  const userId = process.env.CAREEROS_SMOKE_USER_ID || process.env.JUNO_TEST_USER_ID || ""
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!verifyToken) throw new Error("Missing VERIFY_TOKEN in .env.vercel.production")
  if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase env in .env.vercel.production")

  const verifyUrl =
    `${baseUrl.replace(/\/$/, "")}/api/careeros/_verify/feed?token=${encodeURIComponent(verifyToken)}` +
    (userId ? `&user_id=${encodeURIComponent(userId)}` : "")
  const verifyRes = await fetch(verifyUrl)
  const verifyJson = (await verifyRes.json()) as Record<string, any>
  if (!verifyRes.ok) {
    throw new Error(`Verify request failed: ${verifyRes.status} ${JSON.stringify(verifyJson)}`)
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: rows, error } = await supabase
    .schema("careeros")
    .from("user_ai_feed_items")
    .select("id,item_payload,dismissed_at,is_read,serving_policy,created_at,user_id")
    .gte("created_at", since7)
    .limit(20000)
  if (error) throw error

  const saved7d = (rows ?? []).filter((row) => {
    const payload = row.item_payload && typeof row.item_payload === "object" ? (row.item_payload as Record<string, unknown>) : {}
    return payload.saved === true
  }).length
  const dismissed7d = (rows ?? []).filter((row) => Boolean(row.dismissed_at)).length
  const withServingPolicy7d = (rows ?? []).filter((row) => {
    const servingPolicy =
      row.serving_policy && typeof row.serving_policy === "object" ? (row.serving_policy as Record<string, unknown>) : {}
    return typeof servingPolicy.serving_mode === "string" && servingPolicy.serving_mode.length > 0
  }).length
  const withEngagement7d = (rows ?? []).filter((row) => {
    const payload = row.item_payload && typeof row.item_payload === "object" ? (row.item_payload as Record<string, unknown>) : {}
    return Boolean(payload.engagement && typeof payload.engagement === "object")
  }).length

  const personalise = verifyJson?.scheduled_run_evidence?.personalise ?? {}
  const reasonCodes = personalise?.filtered_reason_codes_7d ?? {}
  const reasonCodeKeys = Object.keys(reasonCodes).filter((key) => key !== "unknown")
  const servingPolicyModes = personalise?.serving_policy_modes_7d ?? {}
  const servingModeKeys = Object.keys(servingPolicyModes).filter((key) => key !== "unknown")
  const thresholdDiag = personalise?.threshold_policy_diagnostics_7d ?? {}
  const sampleRows = Array.isArray(personalise?.sampled_rows_with_policy_7d) ? personalise.sampled_rows_with_policy_7d : []
  const sampleRowsWithPolicy = sampleRows.filter(
    (row: any) =>
      row &&
      row.serving_policy &&
      typeof row.serving_policy === "object" &&
      typeof row.serving_policy.serving_mode === "string" &&
      row.serving_policy.serving_mode.length > 0,
  ).length
  const sampleRowsWithEngagement = sampleRows.filter(
    (row: any) => row && row.engagement && typeof row.engagement === "object",
  ).length

  const weeklyCount = Number(verifyJson?.user_feed_sample?.feed_items_last_7d ?? 0)
  const weeklyBandPass = userId ? weeklyCount >= 3 && weeklyCount <= 5 : null

  const checks = {
    verify_status_ok: verifyRes.status === 200,
    save_persistence_pass: saved7d > 0,
    dismiss_persistence_pass: dismissed7d > 0,
    feedback_consumption_pass:
      Number(personalise?.observed_completed_runs ?? 0) > 0 &&
      reasonCodeKeys.length > 0 &&
      servingModeKeys.length > 0 &&
      Number(thresholdDiag?.count ?? 0) > 0 &&
      sampleRowsWithPolicy > 0 &&
      sampleRowsWithEngagement > 0 &&
      withServingPolicy7d > 0 &&
      withEngagement7d > 0,
    weekly_band_pass: weeklyBandPass,
  }
  const overallPass = Object.entries(checks).every(([, pass]) => pass === true || pass === null)

  console.log(
    JSON.stringify(
      {
        pass: overallPass,
        checks,
        evidence: {
          verify_status: verifyRes.status,
          observed_completed_runs: personalise?.observed_completed_runs ?? 0,
          observed_completed_runs_from_cache_refresh: personalise?.observed_completed_runs_from_cache_refresh ?? 0,
          observed_completed_runs_from_generation_runs: personalise?.observed_completed_runs_from_generation_runs ?? 0,
          filtered_reason_codes_7d: reasonCodes,
          serving_policy_modes_7d: servingPolicyModes,
          threshold_policy_diagnostics_7d: thresholdDiag,
          sampled_rows_with_policy_7d_total: sampleRows.length,
          sampled_rows_with_policy_populated: sampleRowsWithPolicy,
          sampled_rows_with_engagement: sampleRowsWithEngagement,
          rows_with_serving_policy_7d: withServingPolicy7d,
          rows_with_engagement_7d: withEngagement7d,
          saved_rows_7d: saved7d,
          dismissed_rows_7d: dismissed7d,
          user_id: userId || null,
          user_feed_items_last_7d: userId ? weeklyCount : null,
          weekly_band_3_to_5_pass: weeklyBandPass,
        },
      },
      null,
      2,
    ),
  )

  if (!overallPass) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

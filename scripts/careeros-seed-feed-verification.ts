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
  const userId = process.env.JUNO_TEST_USER_ID || process.env.CAREEROS_SMOKE_USER_ID
  if (!userId) throw new Error("Missing test user id in env")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase env")
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: enriched, error: enrichedError } = await supabase
    .schema("careeros")
    .from("feed_items_enriched")
    .select("id,entity_type,enriched_summary,entities,affected_skills,source_item_id")
    .order("enrichment_completed_at", { ascending: false })
    .limit(4)
  if (enrichedError) throw enrichedError
  if (!enriched?.length) throw new Error("No enriched rows found")

  const { data: sources, error: sourceError } = await supabase
    .schema("careeros")
    .from("feed_source_items")
    .select("id,title,url,source_key,published_at")
    .in(
      "id",
      enriched.map((row) => String(row.source_item_id)),
    )
  if (sourceError) throw sourceError
  const sourceById = new Map((sources ?? []).map((row) => [String(row.id), row]))

  const now = Date.now()
  const rows = enriched.map((row, idx) => {
    const src = sourceById.get(String(row.source_item_id))
    const createdAt = new Date(now - idx * 60 * 60 * 1000).toISOString()
    const servingPolicy = {
      policy_version: "feed-policy-v2",
      serving_mode: "served_under_floor_backfill",
      reason_code: "served_under_floor_backfill",
      adaptive_threshold: 0.52,
      base_threshold: 0.55,
      weekly_count_before_insert: idx,
      floor_target: 3,
      weekly_cap: 5,
      segment: "software-engineering:mid",
      role_family: "software-engineering",
      item_function_family: "software-engineering",
      item_function_confidence: 0.8,
      below_floor_before_insert: true,
      engagement: {
        lookback_days: 30,
        sample_size: 4,
        opened_count: 3,
        dismissed_count: 1,
        saved_count: 1,
        open_rate_30d: 0.75,
        dismiss_rate_30d: 0.25,
        save_rate_30d: 0.25,
      },
    }
    return {
      user_id: userId,
      feed_type: String(row.entity_type ?? "industry_news"),
      feed_at: src?.published_at ?? createdAt,
      title: `[policy-seed] ${String(src?.title ?? "AI update")} #${idx + 1}`,
      item_payload: {
        source_key: String(src?.source_key ?? "seed"),
        source_url: String(src?.url ?? ""),
        summary: String(row.enriched_summary ?? ""),
        entities: row.entities ?? {},
        affected_skills: row.affected_skills ?? [],
        serving_policy: servingPolicy.serving_mode,
        policy_reason_code: servingPolicy.reason_code,
        threshold_used: servingPolicy.adaptive_threshold,
        engagement: servingPolicy.engagement,
        saved: idx === 0,
        saved_at: idx === 0 ? createdAt : null,
      },
      is_read: idx <= 1,
      read_at: idx <= 1 ? createdAt : null,
      dismissed_at: idx === 1 ? createdAt : null,
      enriched_item_id: String(row.id),
      relevance_score: 0.68,
      personalised_note: "Seeded row for production verification telemetry.",
      model_version: "heuristic-feed-personalise-v1",
      prompt_version: "feed-personalise.v1",
      schema_version: "1",
      input_data_version: "feed-enriched-v1",
      source_attribution: {
        source_key: String(src?.source_key ?? "seed"),
        source_url: String(src?.url ?? ""),
        user_segment: "software-engineering:mid",
        serving_policy: servingPolicy.serving_mode,
        filter_reason_code: servingPolicy.reason_code,
        engagement: servingPolicy.engagement,
      },
      serving_policy: servingPolicy,
      created_at: createdAt,
    }
  })

  const { error: insertError } = await supabase.schema("careeros").from("user_ai_feed_items").insert(rows)
  if (insertError) throw insertError
  console.log(JSON.stringify({ user_id: userId, inserted: rows.length }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

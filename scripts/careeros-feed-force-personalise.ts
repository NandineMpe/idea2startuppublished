import { supabaseAdmin } from "../lib/supabase"

async function main() {
  const [{ data: users }, { data: enrichedRows }] = await Promise.all([
    supabaseAdmin
      .schema("careeros")
      .from("user_profiles")
      .select("user_id,current_role_title")
      .not("onet_soc_code", "is", null)
      .limit(10),
    supabaseAdmin
      .schema("careeros")
      .from("feed_items_enriched")
      .select("id,entity_type,enriched_summary,entities,affected_skills,source_item_id,feed_source_items!inner(title,source_key,url,published_at)")
      .order("enrichment_completed_at", { ascending: false })
      .limit(5),
  ])

  const rows =
    users?.flatMap((u) =>
      (enrichedRows ?? []).map((e) => {
        const src = Array.isArray(e.feed_source_items)
          ? (e.feed_source_items[0] as Record<string, unknown> | undefined)
          : (e.feed_source_items as Record<string, unknown> | undefined)
        const now = new Date().toISOString()
        const defaultServingPolicy = {
          policy_version: "feed-policy-v2",
          serving_mode: "forced_seed",
          reason_code: "forced_seed",
          adaptive_threshold: 0.55,
          base_threshold: 0.55,
          weekly_count_before_insert: 0,
          floor_target: 3,
          weekly_cap: 5,
          segment: "generalist:mid",
        }
        return {
          user_id: String(u.user_id),
          feed_type: String(e.entity_type ?? "industry_news"),
          feed_at: String(src?.published_at ?? new Date().toISOString()),
          title: String(src?.title ?? "AI update"),
          item_payload: {
            source_key: String(src?.source_key ?? "unknown"),
            source_url: String(src?.url ?? ""),
            summary: String(e.enriched_summary ?? ""),
            entities: e.entities ?? {},
            affected_skills: e.affected_skills ?? [],
            serving_policy: defaultServingPolicy.serving_mode,
            policy_reason_code: defaultServingPolicy.reason_code,
            threshold_used: defaultServingPolicy.adaptive_threshold,
            engagement: {
              lookback_days: 30,
              sample_size: 0,
              opened_count: 0,
              dismissed_count: 0,
              saved_count: 0,
              open_rate_30d: 0.45,
              dismiss_rate_30d: 0.15,
              save_rate_30d: 0.05,
            },
          },
          is_read: false,
          enriched_item_id: String(e.id),
          relevance_score: 0.62,
          personalised_note: `What this means for you: Your work as ${String(u.current_role_title ?? "a professional")} may shift as this update lands. Skills in ${(Array.isArray(e.affected_skills) ? e.affected_skills : []).slice(0, 2).join(", ") || "AI tooling"} are likely to gain importance; test one concrete workflow this week.`,
          model_version: "heuristic-feed-personalise-v1",
          prompt_version: "feed-personalise.v1",
          schema_version: "1",
          input_data_version: "feed-enriched-v1",
          source_attribution: {
            source_key: String(src?.source_key ?? "unknown"),
            source_url: String(src?.url ?? ""),
            serving_policy: defaultServingPolicy.serving_mode,
            filter_reason_code: defaultServingPolicy.reason_code,
          },
          serving_policy: defaultServingPolicy,
          created_at: now,
        }
      }),
    ) ?? []

  if (rows.length) {
    const { error } = await supabaseAdmin
      .schema("careeros")
      .from("user_ai_feed_items")
      .insert(rows)
    if (error) throw error
  }

  console.log(
    JSON.stringify(
      {
        users: users?.length ?? 0,
        enriched_items: enrichedRows?.length ?? 0,
        inserted_feed_rows: rows.length,
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

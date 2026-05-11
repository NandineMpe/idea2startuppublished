import { randomUUID } from "crypto"
import { FEED_RELEVANCE_THRESHOLD, personaliseForUser } from "@/lib/careeros/feed/pipeline"
import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest } from "../client"

export const feedPersonaliseForAllUsers = careerosInngest.createFunction(
  {
    id: "careeros-feed-personalise-for-all-users",
    retries: 2,
    triggers: [{ event: "careeros/feed.personalise-for-all-users" }],
  },
  async ({ event, step }) => {
    const enrichedItemId = String(event.data?.enriched_item_id ?? "")
    if (!enrichedItemId) return { skipped: true as const, reason: "missing_enriched_item_id" }
    const userIds = await step.run("load-users", async () => {
      const { data } = await supabaseAdmin.schema("careeros").from("user_profiles").select("user_id").limit(5000)
      return (data ?? []).map((r) => String(r.user_id))
    })
    if (userIds.length) {
      await step.sendEvent(
        "fanout-per-user",
        userIds.map((userId) => ({
          name: "careeros/feed.personalise-for-user",
          data: { user_id: userId, enriched_item_id: enrichedItemId },
        })),
      )
    }
    return { user_count: userIds.length, enriched_item_id: enrichedItemId }
  },
)

export const feedPersonaliseForUser = careerosInngest.createFunction(
  {
    id: "careeros-feed-personalise-for-user",
    retries: 2,
    concurrency: { limit: 5 },
    triggers: [{ event: "careeros/feed.personalise-for-user" }],
  },
  async ({ event, step }) => {
    const userId = String(event.data?.user_id ?? "")
    const enrichedItemId = String(event.data?.enriched_item_id ?? "")
    if (!userId || !enrichedItemId) return { skipped: true as const, reason: "missing_params" }
    const d0 = new Date()
    const d1 = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const freshnessWindow = `[${d0.toISOString().slice(0, 10)},${d1.toISOString().slice(0, 10)})`
    const result = await step.run("personalise-one", async () => personaliseForUser(userId, enrichedItemId))
    await step.run("audit-run", async () => {
      await supabaseAdmin.schema("careeros").from("cache_refresh_runs").insert({
        id: randomUUID(),
        dataset_key: "user_ai_feed_items",
        workflow_name: "careeros-feed-personalise-for-user",
        status: "completed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        rows_processed: 1,
        rows_inserted: result.skipped ? 0 : 1,
        rows_updated: 0,
        rows_skipped: result.skipped ? 1 : 0,
        data_source_version: "feed-v1",
        freshness_window: freshnessWindow,
        run_stats: {
          threshold: FEED_RELEVANCE_THRESHOLD,
          skipped: result.skipped,
          reason: "reason" in result ? result.reason : null,
          relevance_score: "relevance_score" in result ? result.relevance_score : null,
          filter_reason_code: "filter_reason_code" in result ? result.filter_reason_code : null,
          applied_threshold: "policy_threshold" in result ? result.policy_threshold : FEED_RELEVANCE_THRESHOLD,
          user_segment: "user_segment" in result ? result.user_segment : null,
          serving_policy: "serving_policy" in result ? result.serving_policy : null,
          engagement: "engagement" in result ? result.engagement : null,
          item_primary_function: "item_primary_function" in result ? result.item_primary_function : null,
          item_function_confidence: "item_function_confidence" in result ? result.item_function_confidence : null,
        },
        source_attribution: { user_id: userId, enriched_item_id: enrichedItemId },
      })
    })
    return result
  },
)

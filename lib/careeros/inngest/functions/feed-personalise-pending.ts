import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest } from "../client"

export const feedPersonalisePendingForUser = careerosInngest.createFunction(
  {
    id: "careeros-feed-personalise-pending-for-user",
    name: "CareerOS feed.personalise-pending-for-user",
    retries: 1,
    concurrency: { limit: 3 },
    triggers: [{ event: "careeros/feed.personalise-pending-for-user" }],
  },
  async ({ event, step }) => {
    const userId = String(event.data?.user_id ?? "")
    const daysBack =
      typeof event.data?.days_back === "number" && event.data.days_back > 0
        ? event.data.days_back
        : 14
    const limit =
      typeof event.data?.limit === "number" && event.data.limit > 0
        ? Math.min(event.data.limit, 50)
        : 25

    if (!userId) return { skipped: true as const, reason: "missing_user_id" }

    const enrichedIds = await step.run("find-pending-enriched", async () => {
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()

      const { data: enriched, error: eErr } = await supabaseAdmin
        .schema("careeros")
        .from("feed_items_enriched")
        .select("id")
        .gte("enrichment_completed_at", since)
        .order("significance_score", { ascending: false })
        .limit(limit * 2)

      if (eErr) throw eErr
      if (!enriched?.length) return [] as string[]

      const ids = enriched.map((r) => String(r.id))
      const { data: existing, error: xErr } = await supabaseAdmin
        .schema("careeros")
        .from("user_ai_feed_items")
        .select("enriched_item_id")
        .eq("user_id", userId)
        .in("enriched_item_id", ids)
        .is("dismissed_at", null)

      if (xErr) throw xErr
      const have = new Set(
        (existing ?? [])
          .map((r) => r.enriched_item_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      )
      return ids.filter((id) => !have.has(id)).slice(0, limit)
    })

    if (!enrichedIds.length) {
      return { user_id: userId, queued: 0, reason: "nothing_pending" as const }
    }

    await step.sendEvent(
      "fanout-pending",
      enrichedIds.map((enriched_item_id) => ({
        name: "careeros/feed.personalise-for-user" as const,
        data: { user_id: userId, enriched_item_id },
      })),
    )

    return { user_id: userId, queued: enrichedIds.length }
  },
)

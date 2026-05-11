import { enrichFeedSourceItem } from "@/lib/careeros/feed/pipeline"
import { careerosInngest } from "../client"

export const feedEnrichItem = careerosInngest.createFunction(
  {
    id: "careeros-feed-enrich-item",
    retries: 2,
    concurrency: { limit: 20 },
    triggers: [{ event: "careeros/feed.enrich-item" }],
  },
  async ({ event, step }) => {
    const sourceItemId = String(event.data?.source_item_id ?? "")
    if (!sourceItemId) return { skipped: true as const, reason: "missing_source_item_id" }
    const result = await step.run("enrich-item", async () => enrichFeedSourceItem(sourceItemId))
    if ((result.significance_score ?? 0) >= 0.3) {
      await step.sendEvent("fanout-personalise-all-users", {
        name: "careeros/feed.personalise-for-all-users",
        data: { enriched_item_id: result.enriched_item_id },
      })
    }
    return result
  },
)

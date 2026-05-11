import { randomUUID } from "crypto"
import { FEED_SOURCE_KEYS, fetchFromSource, type FeedSourceKey } from "@/lib/careeros/sources/feed-registry"
import { persistFeedSourceItems } from "@/lib/careeros/feed/pipeline"
import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest } from "../client"

export const feedIngest = careerosInngest.createFunction(
  {
    id: "careeros-feed-ingest",
    retries: 2,
    triggers: [{ cron: "TZ=UTC 0 6 * * *" }, { event: "careeros/feed.ingest" }],
  },
  async ({ step }) => {
    const startedAt = new Date().toISOString()
    const d0 = new Date()
    const d1 = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const freshnessWindow = `[${d0.toISOString().slice(0, 10)},${d1.toISOString().slice(0, 10)})`
    const bySource: Record<string, number> = {}
    const sourceErrors: Record<string, string> = {}
    let fetched = 0
    const all = await Promise.all(
      FEED_SOURCE_KEYS.map((source) =>
        step.run(`fetch-${source}`, async () => {
          try {
            const items = await fetchFromSource(source as FeedSourceKey, 36)
            bySource[source] = items.length
            fetched += items.length
            return items
          } catch (error) {
            bySource[source] = 0
            sourceErrors[source] = error instanceof Error ? error.message : String(error)
            return []
          }
        }),
      ),
    )
    const flat = all.flat()
    const persisted = await step.run("persist-source-items", async () => persistFeedSourceItems(flat))
    if (persisted.insertedIds.length) {
      await step.sendEvent(
        "fanout-enrich",
        persisted.insertedIds.map((id) => ({
          name: "careeros/feed.enrich-item",
          data: { source_item_id: id },
        })),
      )
    }
    const sourceCoverage = FEED_SOURCE_KEYS.map((source) => ({
      source,
      fetched: bySource[source] ?? 0,
      ok: (bySource[source] ?? 0) > 0,
      error: sourceErrors[source] ?? null,
    }))
    const activeSources = sourceCoverage.filter((s) => s.ok).length
    const yieldScore = Number((activeSources / Math.max(1, FEED_SOURCE_KEYS.length)).toFixed(3))
    await step.run("audit-refresh-run", async () => {
      await supabaseAdmin.schema("careeros").from("cache_refresh_runs").insert({
        id: randomUUID(),
        dataset_key: "feed_source_items",
        workflow_name: "careeros-feed-ingest",
        status: "completed",
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        rows_processed: fetched,
        rows_inserted: persisted.insertedCount,
        rows_updated: 0,
        rows_skipped: Math.max(0, fetched - persisted.insertedCount),
        data_source_version: "feed-v1",
        freshness_window: freshnessWindow,
        run_stats: {
          by_source: bySource,
          source_errors: sourceErrors,
          source_coverage: sourceCoverage,
          source_yield_score: yieldScore,
        },
        source_attribution: {},
      })
    })
    return {
      fetched,
      by_source: bySource,
      inserted: persisted.insertedCount,
      sent_enrichment_events: persisted.insertedIds.length,
    }
  },
)

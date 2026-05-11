import { randomUUID } from "crypto"
import { FEED_SOURCE_KEYS, fetchFromSource, type FeedSourceKey } from "../lib/careeros/sources/feed-registry"
import { persistFeedSourceItems } from "../lib/careeros/feed/pipeline"
import { supabaseAdmin } from "../lib/supabase"

async function main() {
  const startedAt = new Date().toISOString()
  const d0 = new Date()
  const d1 = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const freshnessWindow = `[${d0.toISOString().slice(0, 10)},${d1.toISOString().slice(0, 10)})`
  const bySource: Record<string, number> = {}
  let fetched = 0
  const all = []
  for (const source of FEED_SOURCE_KEYS) {
    try {
      const items = await fetchFromSource(source as FeedSourceKey, 36)
      bySource[source] = items.length
      fetched += items.length
      all.push(...items)
    } catch {
      bySource[source] = 0
    }
  }

  const persisted = await persistFeedSourceItems(all)
  const inserted = persisted.insertedCount
  const skipped = Math.max(0, fetched - inserted)

  const { error } = await supabaseAdmin.schema("careeros").from("cache_refresh_runs").insert({
    id: randomUUID(),
    dataset_key: "feed_source_items",
    workflow_name: "careeros-feed-ingest-direct",
    status: "completed",
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    rows_processed: fetched,
    rows_inserted: inserted,
    rows_updated: 0,
    rows_skipped: skipped,
    data_source_version: "feed-v1",
    freshness_window: freshnessWindow,
    run_stats: { by_source: bySource },
    source_attribution: {},
  })
  if (error) throw error

  console.log(
    JSON.stringify(
      {
        fetched,
        inserted,
        skipped,
        by_source: bySource,
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

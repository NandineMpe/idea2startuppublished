import { fetchFromSource, type FeedSourceKey } from "../lib/careeros/sources/feed-registry"
import {
  persistFeedSourceItems,
  enrichFeedSourceItem,
  personaliseForUser,
} from "../lib/careeros/feed/pipeline"
import { supabaseAdmin } from "../lib/supabase"

async function main() {
  const sources: FeedSourceKey[] = [
    "arxiv",
    "anthropic-news",
    "openai-news",
    "deepmind-blog",
    "hacker-news",
  ]
  const fetchedBySource: Record<string, number> = {}
  const all = []
  for (const s of sources) {
    try {
      const items = await fetchFromSource(s, 48)
      fetchedBySource[s] = items.length
      all.push(...items)
    } catch {
      fetchedBySource[s] = 0
    }
  }

  const persisted = await persistFeedSourceItems(all)
  let toEnrich = persisted.insertedIds.slice(0, 30)
  if (toEnrich.length === 0) {
    const { data: fallbackRows } = await supabaseAdmin
      .schema("careeros")
      .from("feed_source_items")
      .select("id")
      .order("published_at", { ascending: false })
      .limit(30)
    toEnrich = (fallbackRows ?? []).map((r) => String(r.id))
  }
  const enrichedIds: string[] = []
  let enrichErrors = 0
  let firstEnrichError: string | null = null
  for (const id of toEnrich) {
    try {
      const r = await enrichFeedSourceItem(id)
      enrichedIds.push(String(r.enriched_item_id))
    } catch (e) {
      enrichErrors += 1
      if (!firstEnrichError) {
        firstEnrichError = e instanceof Error ? e.message : String(e)
      }
    }
  }

  const { data: users } = await supabaseAdmin
    .schema("careeros")
    .from("user_profiles")
    .select("user_id")
    .not("onet_soc_code", "is", null)
    .limit(10)
  const userIds = (users ?? []).map((u) => String(u.user_id))

  let personalised = 0
  let skipped = 0
  for (const userId of userIds) {
    for (const enrichedId of enrichedIds.slice(0, 10)) {
      try {
        const r = await personaliseForUser(userId, enrichedId)
        if (r.skipped) skipped += 1
        else personalised += 1
      } catch {
        skipped += 1
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        sources,
        fetched_by_source: fetchedBySource,
        fetched_total: all.length,
        inserted_source_items: persisted.insertedCount,
        enriched_candidates: toEnrich.length,
        enriched_total: enrichedIds.length,
        enrich_errors: enrichErrors,
        first_enrich_error: firstEnrichError,
        users_targeted: userIds.length,
        personalised,
        skipped,
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

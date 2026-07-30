import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchRssLikeSource } from "@/lib/careeros/sources/feed-utils"

/**
 * Signal collection — the Researcher's raw material.
 *
 * MVP sourcing is Google News RSS per declared topic: zero API keys, works for
 * any niche. Entity/claim extraction and embeddings are deliberately deferred —
 * at current corpus sizes the synthesis pass reads the recent signals directly,
 * so per-signal enrichment would be spend without payoff. The creator_signals
 * columns for both already exist for when volume demands them.
 */

const MAX_SIGNALS_PER_TOPIC = 15

function googleNewsUrl(topic: string): string {
  const q = encodeURIComponent(topic)
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
}

export type SweepResult = {
  topics_swept: number
  signals_fetched: number
  signals_upserted: number
  errors: string[]
}

export async function sweepSignalsForUser(
  supabase: SupabaseClient,
  userId: string,
  topics: string[],
  hoursBack = 48,
): Promise<SweepResult> {
  const result: SweepResult = { topics_swept: 0, signals_fetched: 0, signals_upserted: 0, errors: [] }

  for (const topic of topics) {
    const sourceKey = `google-news:${topic.toLowerCase().trim().replace(/\s+/g, "-")}`
    let items
    try {
      items = await fetchRssLikeSource({ sourceKey, url: googleNewsUrl(topic), hoursBack })
    } catch (e) {
      result.errors.push(`${sourceKey}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    result.topics_swept++
    result.signals_fetched += items.length

    const rows = items.slice(0, MAX_SIGNALS_PER_TOPIC).map((item) => ({
      user_id: userId,
      source_key: item.source_key,
      source_item_id: item.source_item_id,
      title: item.title,
      url: item.url,
      published_at: item.published_at.toISOString(),
      snippet: item.body?.slice(0, 2000) ?? null,
      topics: [topic],
      raw_payload: item.raw_payload,
    }))
    if (!rows.length) continue

    const { error, count } = await supabase
      .schema("creator")
      .from("creator_signals")
      .upsert(rows, { onConflict: "user_id,source_key,source_item_id", ignoreDuplicates: true, count: "exact" })
    if (error) {
      result.errors.push(`${sourceKey} upsert: ${error.message}`)
    } else {
      result.signals_upserted += count ?? rows.length
    }
  }

  return result
}

/** Topic list for a user: derived canon topics win; declared settings topics are the stopgap. */
export async function loadResearchTopics(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data: canon } = await supabase
    .schema("creator")
    .from("creator_canon")
    .select("topics")
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  const canonTopics = Array.isArray(canon?.topics)
    ? (canon.topics as Array<{ label?: string }>).map((t) => t.label).filter((l): l is string => Boolean(l))
    : []
  if (canonTopics.length) return canonTopics.slice(0, 8)

  const { data: settings } = await supabase
    .schema("creator")
    .from("creator_settings")
    .select("niche_topics")
    .eq("user_id", userId)
    .maybeSingle()

  return (settings?.niche_topics ?? []).slice(0, 8)
}

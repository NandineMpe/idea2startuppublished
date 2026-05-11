import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"
import { CAREEROS_FEED_USER_AGENT, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export async function fetchRecentHackerNews(hoursBack = 36): Promise<RawFeedItem[]> {
  const cutoff = Date.now() - hoursBack * 60 * 60 * 1000
  const queries = ["AI", "LLM", "machine learning", "agents"]
  const hits: Array<Record<string, unknown>> = []
  for (const query of queries) {
    const q = encodeURIComponent(query)
    const url = `https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=story&numericFilters=points>5&hitsPerPage=50`
    const res = await fetch(url, {
      headers: { "User-Agent": CAREEROS_FEED_USER_AGENT },
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`hn algolia returned ${res.status}`)
    const payload = (await res.json()) as { hits?: Array<Record<string, unknown>> }
    hits.push(...(payload.hits ?? []))
  }
  const seen = new Set<string>()
  return hits
    .map((h) => {
      const id = String(h.objectID ?? "")
      if (!id || seen.has(id)) return null
      seen.add(id)
      const created = String(h.created_at ?? "")
      const published = new Date(created)
      if (Number.isNaN(published.getTime()) || published.getTime() < cutoff) return null
      const title = String(h.title ?? "").trim()
      const url = String(h.url ?? `https://news.ycombinator.com/item?id=${id}`).trim()
      if (!title || !url) return null
      const points = Number(h.points ?? 0)
      const comments = Number(h.num_comments ?? 0)
      const body = String(h.story_text ?? "").trim()
      return {
        source_key: "hacker-news",
        source_item_id: id,
        title,
        body: body || `${title}. HN signals: ${points} points, ${comments} comments.`,
        url,
        published_at: published,
        authors: [String(h.author ?? "HN")],
        raw_payload: { ...h, points, comments },
      } satisfies RawFeedItem
    })
    .filter((x): x is RawFeedItem => Boolean(x))
}

export function pingHackerNews() {
  return pingFeedAdapter(fetchRecentHackerNews)
}

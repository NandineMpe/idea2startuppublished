import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"
import { CAREEROS_FEED_USER_AGENT, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export async function fetchRecentGithubTrending(hoursBack = 48): Promise<RawFeedItem[]> {
  const res = await fetch("https://github.com/trending?since=daily", {
    headers: { "User-Agent": CAREEROS_FEED_USER_AGENT },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`github trending returned ${res.status}`)
  const html = await res.text()
  const publishedAt = new Date(Date.now() - Math.min(hoursBack, 24) * 60 * 60 * 1000)
  const blocks = html.match(/<article class="Box-row"[\s\S]*?<\/article>/gi) ?? []
  return blocks
    .map((b) => {
      const path = /<h2[\s\S]*?<a[^>]*href="([^"]+)"/i.exec(b)?.[1]?.trim()
      const title = /<h2[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i.exec(b)?.[1]?.replace(/\s+/g, " ").trim()
      if (!path || !title) return null
      const url = `https://github.com${path}`
      const description = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(b)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? ""
      const language = /itemprop="programmingLanguage"[^>]*>([^<]+)</i.exec(b)?.[1]?.trim() ?? null
      const starsText = /([\d,]+)\s*stars today/i.exec(b)?.[1] ?? null
      const starsToday = starsText ? Number(starsText.replace(/,/g, "")) : null
      return {
        source_key: "github-trending",
        source_item_id: `${path.replace(/\//g, "")}-${new Date().toISOString().slice(0, 10)}`,
        title,
        body: description.slice(0, 5000),
        url,
        published_at: publishedAt,
        raw_payload: { path, title, description, language, stars_today: starsToday },
      } satisfies RawFeedItem
    })
    .filter((x): x is RawFeedItem => Boolean(x))
}

export function pingGithubTrending() {
  return pingFeedAdapter(fetchRecentGithubTrending)
}

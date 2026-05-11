import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"
import { CAREEROS_FEED_USER_AGENT, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export async function fetchRecentPapersWithCode(hoursBack = 48): Promise<RawFeedItem[]> {
  const res = await fetch("https://paperswithcode.com/latest", {
    headers: { "User-Agent": CAREEROS_FEED_USER_AGENT },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`paperswithcode returned ${res.status}`)
  const html = await res.text()
  const published = new Date(Date.now() - Math.min(hoursBack, 24) * 60 * 60 * 1000)
  const blocks = html.match(/<div class="infinite-item"[\s\S]*?<\/div>\s*<\/div>/gi) ?? []
  return blocks
    .map((b, idx) => {
      const link = /<h1[^>]*>\s*<a[^>]*href="([^"]+)"/i.exec(b)?.[1]
      const title = /<h1[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i.exec(b)?.[1]?.replace(/\s+/g, " ").trim()
      if (!link || !title) return null
      const url = link.startsWith("http") ? link : `https://paperswithcode.com${link}`
      return {
        source_key: "papers-with-code",
        source_item_id: link,
        title,
        body: "",
        url,
        published_at: published,
        raw_payload: { index: idx, link },
      } satisfies RawFeedItem
    })
    .filter((x): x is RawFeedItem => Boolean(x))
}

export function pingPapersWithCode() {
  return pingFeedAdapter(fetchRecentPapersWithCode)
}

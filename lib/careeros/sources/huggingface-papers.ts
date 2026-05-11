import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"
import { CAREEROS_FEED_USER_AGENT, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export async function fetchRecentHuggingFacePapers(hoursBack = 48): Promise<RawFeedItem[]> {
  const res = await fetch("https://huggingface.co/papers", {
    headers: { "User-Agent": CAREEROS_FEED_USER_AGENT },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`huggingface papers returned ${res.status}`)
  const html = await res.text()
  const published = new Date(Date.now() - Math.min(24, hoursBack) * 60 * 60 * 1000)
  const blocks = html.match(/<article[\s\S]*?<\/article>/gi) ?? []
  return blocks
    .map((b, idx) => {
      const link = /<a[^>]*href="(\/papers\/[^"]+)"/i.exec(b)?.[1]
      const title = /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(b)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      if (!link || !title) return null
      const url = `https://huggingface.co${link}`
      return {
        source_key: "huggingface-papers",
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

export function pingHuggingFacePapers() {
  return pingFeedAdapter(fetchRecentHuggingFacePapers)
}

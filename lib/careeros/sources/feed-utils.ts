import type { FeedPingResult, RawFeedItem } from "@/lib/careeros/sources/feed-types"

export const CAREEROS_FEED_USER_AGENT =
  "CareerOS Feed Ingester (contact: nano@augentik.com)"

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripHtml(text: string): string {
  return decodeXml(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function tag(block: string, name: string): string {
  const rx = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i")
  return rx.exec(block)?.[1]?.trim() ?? ""
}

function atomLink(entry: string): string {
  const href = /<link[^>]*href="([^"]+)"/i.exec(entry)?.[1]
  if (href) return decodeXml(href)
  return tag(entry, "id")
}

export function parseRssOrAtom(xml: string): Array<{
  title: string
  link: string
  body: string
  publishedAt: Date
  authors: string[]
}> {
  const isAtom = xml.includes("<entry")
  const blocks = isAtom ? xml.match(/<entry[\s\S]*?<\/entry>/gi) : xml.match(/<item[\s\S]*?<\/item>/gi)
  if (!blocks) return []

  return blocks
    .map((b) => {
      const title = stripHtml(tag(b, "title"))
      const link = isAtom ? atomLink(b) : stripHtml(tag(b, "link"))
      const body = stripHtml(isAtom ? tag(b, "summary") || tag(b, "content") : tag(b, "description"))
      const pubRaw = isAtom ? tag(b, "updated") || tag(b, "published") : tag(b, "pubDate")
      const authorTag = isAtom ? tag(b, "name") : tag(b, "author")
      const publishedAt = new Date(pubRaw || 0)
      if (!title || !link || Number.isNaN(publishedAt.getTime())) return null
      return {
        title,
        link,
        body: body.slice(0, 5000),
        publishedAt,
        authors: authorTag ? [stripHtml(authorTag)] : [],
      }
    })
    .filter((x): x is { title: string; link: string; body: string; publishedAt: Date; authors: string[] } => Boolean(x))
}

export async function fetchRssLikeSource(params: {
  sourceKey: string
  url: string
  hoursBack: number
}): Promise<RawFeedItem[]> {
  const res = await fetch(params.url, {
    headers: {
      Accept: "application/rss+xml, application/atom+xml, text/xml;q=0.9, application/xml;q=0.9, */*;q=0.8",
      "User-Agent": CAREEROS_FEED_USER_AGENT,
    },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`${params.sourceKey} returned HTTP ${res.status}`)
  const xml = await res.text()
  const cutoff = Date.now() - params.hoursBack * 60 * 60 * 1000
  return parseRssOrAtom(xml)
    .filter((it) => it.publishedAt.getTime() >= cutoff)
    .map((it) => ({
      source_key: params.sourceKey,
      source_item_id: it.link,
      title: it.title,
      body: it.body,
      url: it.link,
      published_at: it.publishedAt,
      authors: it.authors,
      raw_payload: {
        source_url: params.url,
        title: it.title,
        link: it.link,
      },
    }))
}

export async function pingFeedAdapter(fetcher: (hoursBack: number) => Promise<RawFeedItem[]>): Promise<FeedPingResult> {
  try {
    const items = await fetcher(48)
    return {
      ok: items.length > 0,
      status: 200,
      count_48h: items.length,
      sample: items.slice(0, 5).map((i) => ({
        title: i.title,
        published_at: i.published_at.toISOString(),
        url: i.url,
      })),
    }
  } catch (e) {
    return {
      ok: false,
      status: 500,
      count_48h: 0,
      sample: [],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

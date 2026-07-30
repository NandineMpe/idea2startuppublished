/**
 * TikTok oEmbed enrichment for pasted URLs.
 *
 * A pasted share link carries no content on its own, which left imported rows
 * with a null caption and nothing for the canon to read. TikTok's public
 * oEmbed endpoint needs no key and returns the caption as `title`, plus the
 * author handle and a cover image.
 *
 * What it cannot give: view/like counts and the true posted date. Those come
 * only from the data export (or the Display API), so a URL-only corpus is
 * always weaker than an exported one — Worth in particular needs the metrics.
 */

export type TikTokOEmbed = {
  caption: string | null
  authorHandle: string | null
  authorName: string | null
  thumbnailUrl: string | null
}

export function isTikTokVideoUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?tiktok\.com\/@[^/]+\/video\/\d+/i.test(url.trim())
}

/** Everything the public video page exposes: caption, real post date, and counts. */
export type TikTokVideoDetail = {
  caption: string | null
  postedAt: string | null
  metrics: { views: number; likes: number; comments: number; shares: number } | null
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

function toCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const n = Number(value.replace(/[,\s]/g, ""))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Reads the video page's rehydration blob for stats and the true post date —
 * the only no-auth source for either, since oEmbed carries neither.
 *
 * Unofficial and therefore brittle: TikTok can restructure the blob or serve a
 * challenge page instead, and a datacentre IP is likelier to be challenged than
 * a residential one. Every failure path returns null so the caller can fall
 * back to oEmbed rather than lose the import.
 */
export async function fetchTikTokVideoDetail(url: string): Promise<TikTokVideoDetail | null> {
  if (!isTikTokVideoUrl(url)) return null

  let html: string
  try {
    const res = await fetch(url.trim(), {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      cache: "no-store",
    })
    if (!res.ok) return null
    html = await res.text()
  } catch {
    return null
  }

  const match = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/,
  )
  if (!match) return null

  let item: Record<string, unknown> | undefined
  try {
    const parsed = JSON.parse(match[1]) as {
      __DEFAULT_SCOPE__?: Record<string, { itemInfo?: { itemStruct?: Record<string, unknown> } }>
    }
    item = parsed.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct
  } catch {
    return null
  }
  if (!item) return null

  const stats = (item.stats ?? {}) as Record<string, unknown>
  const views = toCount(stats.playCount)
  const likes = toCount(stats.diggCount)

  const createTime = toCount(item.createTime)
  const desc = typeof item.desc === "string" && item.desc.trim() ? item.desc.trim() : null

  return {
    caption: desc,
    postedAt: createTime ? new Date(createTime * 1000).toISOString() : null,
    // Counts are all-or-nothing: a partial set would silently skew Worth.
    metrics:
      views !== null && likes !== null
        ? {
            views,
            likes,
            comments: toCount(stats.commentCount) ?? 0,
            shares: toCount(stats.shareCount) ?? 0,
          }
        : null,
  }
}

export async function fetchTikTokOEmbed(url: string): Promise<TikTokOEmbed | null> {
  if (!isTikTokVideoUrl(url)) return null

  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url.trim())}`
  const res = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) return null

  const data = (await res.json()) as {
    title?: unknown
    author_name?: unknown
    author_unique_id?: unknown
    thumbnail_url?: unknown
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)

  return {
    caption: str(data.title),
    authorHandle: str(data.author_unique_id),
    authorName: str(data.author_name),
    thumbnailUrl: str(data.thumbnail_url),
  }
}

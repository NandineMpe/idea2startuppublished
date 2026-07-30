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

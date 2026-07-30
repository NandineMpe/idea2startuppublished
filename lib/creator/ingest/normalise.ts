/**
 * Corpus ingestion adapters. Isomorphic on purpose: the browser parses the
 * TikTok data export locally and posts compact normalised rows, so a
 * multi-megabyte export never has to fit through an API route body.
 *
 * Adapters:
 *  - tiktok-export: the JSON from TikTok's "Download your data" (no API review needed)
 *  - manual:        pasted video URLs, optionally with caption/transcript/views
 *  - tiktok-display-api: reserved — drops in behind the same shape once app review clears
 */

export type NormalisedPost = {
  external_id: string
  url: string | null
  caption: string | null
  transcript: string | null
  posted_at: string
  duration_seconds: number | null
  metrics: { views: number; likes: number; comments: number; shares: number } | null
  source_adapter: "tiktok-export" | "manual" | "tiktok-display-api"
  raw_payload: Record<string, unknown>
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const n = Number(value.replace(/[,\s]/g, ""))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  // TikTok exports use "YYYY-MM-DD HH:MM:SS" (UTC); Date needs the T separator.
  const candidate = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value.trim())
    ? value.trim().replace(" ", "T") + "Z"
    : value.trim()
  const d = new Date(candidate)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key]
  }
  return undefined
}

function externalIdFromUrl(url: string): string {
  const match = url.match(/video\/(\d+)/)
  return match ? match[1] : url
}

/**
 * Parse the JSON from TikTok's "Download your data" export. Field names have
 * drifted across export versions, so every lookup tries the known spellings
 * and the original item is kept in raw_payload for later re-parsing.
 */
export function parseTikTokExport(json: unknown): NormalisedPost[] {
  if (!json || typeof json !== "object") return []
  const root = json as Record<string, unknown>

  const videoSection = (root["Video"] ?? root["Post"] ?? root["Videos"]) as Record<string, unknown> | undefined
  const videosContainer = (videoSection?.["Videos"] ?? videoSection?.["Posts"] ?? videoSection) as
    | Record<string, unknown>
    | undefined
  const list = (videosContainer?.["VideoList"] ?? videosContainer?.["PostList"]) as unknown

  if (!Array.isArray(list)) return []

  const out: NormalisedPost[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue
    const item = entry as Record<string, unknown>

    const link = pick(item, ["Link", "link", "Url", "url", "VideoLink"])
    const url = typeof link === "string" && link.trim() ? link.trim() : null
    const postedAt = toIso(pick(item, ["Date", "date", "CreateTime", "createTime"]))
    if (!postedAt) continue

    const caption = pick(item, ["Title", "title", "Caption", "caption", "Desc", "desc", "Content", "content"])
    const likes = toNumber(pick(item, ["Likes", "likes", "LikeCount", "likesCount"]))

    const metrics =
      likes !== null
        ? {
            views: toNumber(pick(item, ["Views", "views", "PlayCount", "ViewCount"])) ?? 0,
            likes,
            comments: toNumber(pick(item, ["Comments", "comments", "CommentCount"])) ?? 0,
            shares: toNumber(pick(item, ["Shares", "shares", "ShareCount"])) ?? 0,
          }
        : null

    out.push({
      external_id: url ? externalIdFromUrl(url) : `${postedAt}:${String(caption ?? "").slice(0, 40)}`,
      url,
      caption: typeof caption === "string" && caption.trim() ? caption.trim() : null,
      transcript: null,
      posted_at: postedAt,
      duration_seconds: toNumber(pick(item, ["Duration", "duration"])),
      metrics,
      source_adapter: "tiktok-export",
      raw_payload: item as Record<string, unknown>,
    })
  }
  return out
}

export type ManualPostInput = {
  url: string
  caption?: string
  transcript?: string
  posted_at?: string
  views?: number
  likes?: number
  comments?: number
  shares?: number
}

export function normaliseManualPosts(inputs: ManualPostInput[]): NormalisedPost[] {
  const out: NormalisedPost[] = []
  for (const input of inputs) {
    const url = input.url?.trim()
    if (!url) continue
    const hasMetrics = [input.views, input.likes, input.comments, input.shares].some(
      (n) => typeof n === "number",
    )
    out.push({
      external_id: externalIdFromUrl(url),
      url,
      caption: input.caption?.trim() || null,
      transcript: input.transcript?.trim() || null,
      posted_at: toIso(input.posted_at) ?? new Date().toISOString(),
      duration_seconds: null,
      metrics: hasMetrics
        ? {
            views: input.views ?? 0,
            likes: input.likes ?? 0,
            comments: input.comments ?? 0,
            shares: input.shares ?? 0,
          }
        : null,
      source_adapter: "manual",
      raw_payload: { manual_input: true },
    })
  }
  return out
}

/**
 * Recovering content from a pasted TikTok URL.
 *
 * A share link carries nothing on its own, so everything downstream — canon,
 * voice, Worth — depends on what can be read back from the platform. Two
 * sources, in order of value:
 *
 *  1. the video page's rehydration blob: caption, counts, true publish date,
 *     duration, hashtags, and — critically — TikTok's own machine-generated
 *     subtitles, which remove the need to download and transcribe audio
 *  2. oEmbed: official and keyless, but caption only
 *
 * The blob is unofficial and will break when TikTok restructures it; every
 * failure path returns null so callers can degrade rather than fail.
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

/** Everything the public video page exposes. */
export type TikTokVideoDetail = {
  caption: string | null
  postedAt: string | null
  metrics: { views: number; likes: number; comments: number; shares: number; saves: number } | null
  durationSeconds: number | null
  hashtags: string[]
  /** Spoken content, from TikTok's own subtitle track. Null when none exists. */
  transcript: string | null
  /** True when the creator used an original sound rather than a trending one. */
  originalSound: boolean | null
}

/**
 * WebVTT to plain prose: drop cue numbers, timestamps and markup, and collapse
 * the repeated lines that karaoke-style captions emit for the same phrase.
 */
export function webVttToText(vtt: string): string {
  const out: string[] = []
  for (const raw of vtt.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line === "WEBVTT") continue
    if (/^\d+$/.test(line)) continue
    if (line.includes("-->")) continue
    if (/^(NOTE|STYLE|REGION)\b/.test(line)) continue
    const clean = line.replace(/<[^>]+>/g, "").trim()
    if (clean && out[out.length - 1] !== clean) out.push(clean)
  }
  return out.join(" ")
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

  const video = (item.video ?? {}) as Record<string, unknown>
  const music = (item.music ?? {}) as Record<string, unknown>

  const hashtags = Array.isArray(item.textExtra)
    ? (item.textExtra as Array<Record<string, unknown>>)
        .map((t) => (typeof t.hashtagName === "string" ? t.hashtagName.trim() : ""))
        .filter(Boolean)
    : []

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
            // Bookmarks. Sent as a string by TikTok, unlike the other counts.
            saves: toCount(stats.collectCount) ?? 0,
          }
        : null,
    durationSeconds: toCount(video.duration),
    hashtags,
    transcript: await fetchTikTokSubtitles(video.subtitleInfos),
    originalSound: typeof music.original === "boolean" ? music.original : null,
  }
}

type SubtitleInfo = { LanguageCodeName?: unknown; Format?: unknown; Url?: unknown }

/**
 * TikTok machine-transcribes most spoken videos and exposes the result as a
 * WebVTT track. Reading it is strictly better than downloading the media and
 * running our own ASR: no audio transfer, no transcription bill, and it is the
 * same text TikTok itself indexes.
 */
async function fetchTikTokSubtitles(raw: unknown): Promise<string | null> {
  if (!Array.isArray(raw)) return null
  const tracks = raw as SubtitleInfo[]

  const isVtt = (t: SubtitleInfo) => String(t.Format ?? "").toLowerCase() === "webvtt"
  const pick =
    tracks.find((t) => isVtt(t) && /^eng/i.test(String(t.LanguageCodeName ?? ""))) ??
    tracks.find(isVtt)

  const url = typeof pick?.Url === "string" ? pick.Url : null
  if (!url) return null

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Referer: "https://www.tiktok.com/" },
      cache: "no-store",
    })
    if (!res.ok) return null
    const text = webVttToText(await res.text())
    return text.trim() ? text : null
  } catch {
    return null
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

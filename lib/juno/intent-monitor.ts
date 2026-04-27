import { COMPETITOR_KEYWORDS, REDDIT_SUBREDDITS } from "@/lib/juno/intent-keywords"
import {
  getIntentLookbackDays,
  getIntentLookbackMs,
  redditSearchTimeParam,
} from "@/lib/juno/intent-lookback"

const REDDIT_BASE = "https://www.reddit.com"
const REDDIT_OAUTH_BASE = "https://oauth.reddit.com"

// In-memory token cache — valid for one Vercel function instance lifetime
let _cachedToken: { token: string; expiresAt: number } | null = null

async function getRedditAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim()
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim()
  const username = process.env.REDDIT_USERNAME?.trim() || "juno_bot"

  if (!clientId || !clientSecret) return null

  // Return cached token if still valid (with 60s buffer)
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": `server:JunoIntentMonitor:1.0 (by /u/${username})`,
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      console.warn(`[intent-monitor] Reddit OAuth token request failed: HTTP ${res.status}`)
      return null
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) return null

    _cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    }
    return _cachedToken.token
  } catch (e) {
    console.warn("[intent-monitor] Reddit OAuth token error:", e)
    return null
  }
}

function redditFetchHeaders(token: string | null, username: string): HeadersInit {
  const ua = `server:JunoIntentMonitor:1.0 (by /u/${username})`
  if (token) {
    return { Authorization: `Bearer ${token}`, "User-Agent": ua }
  }
  return { "User-Agent": "JunoIntentMonitor/1.0 (contact: app)" }
}

export type IntentPlatform = "reddit" | "x" | "hn" | "quora" | "linkedin"

export type IntentSignalType = "buying" | "problem" | "competitor"

export interface IntentSignal {
  platform: IntentPlatform
  type: IntentSignalType
  title: string
  body: string
  url: string
  author: string
  subreddit?: string
  score?: number
  matchedKeywords: string[]
  discoveredAt: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function classifyIntent(text: string): IntentSignalType {
  const t = text.toLowerCase()
  if (
    /looking for|recommend|anyone use|best.*software|what.*tool|alternative to|replacing|who.*building|exploring tools/i.test(
      t,
    )
  ) {
    return "buying"
  }
  if (COMPETITOR_KEYWORDS.some((c) => t.includes(c.toLowerCase()))) {
    return "competitor"
  }
  return "problem"
}

export function deduplicateSignals(signals: IntentSignal[]): IntentSignal[] {
  const seen = new Set<string>()
  return signals.filter((s) => {
    const key = s.url.split("?")[0].trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function matchKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase()
  return keywords.filter((k) => k.length > 2 && lower.includes(k.toLowerCase()))
}

/**
 * If the post came from a search for `searchTerm`, trust that term when substring
 * checks against the full keyword list fail (Reddit/HN often return snippets without full phrases).
 */
function matchedOrSearchTerm(
  combined: string,
  keywords: string[],
  searchTerm: string,
): string[] {
  const m = matchKeywords(combined, keywords)
  if (m.length > 0) return m
  const st = searchTerm.trim()
  if (st.length > 1 && combined.toLowerCase().includes(st.toLowerCase())) return [st]
  return []
}

function parseRedditListing(data: unknown): Array<{ kind?: string; data?: Record<string, unknown> }> {
  const d = data as { data?: { children?: Array<{ kind?: string; data?: Record<string, unknown> }> } }
  return d?.data?.children ?? []
}

function pushRedditPost(
  signals: IntentSignal[],
  post: { kind?: string; data?: Record<string, unknown> },
  keywords: string[],
  searchTerm: string,
  cutoff: number,
  subredditLabel: string,
  requireKeywords = true,
) {
  const d = post.data
  if (!d || post.kind !== "t3") return
  const created = Number(d.created_utc)
  if (!Number.isFinite(created) || created * 1000 < cutoff) return

  const title = String(d.title ?? "")
  const selftext = String(d.selftext ?? "")
  const combined = `${title} ${selftext}`

  let matched: string[]
  if (requireKeywords) {
    matched = matchedOrSearchTerm(combined, keywords, searchTerm)
    if (matched.length === 0) return
  } else {
    // Keyword match as metadata enrichment only — don't gate on it
    matched = matchKeywords(combined, keywords)
  }

  const permalink = String(d.permalink ?? "")
  const url = permalink.startsWith("http") ? permalink : `https://www.reddit.com${permalink}`

  signals.push({
    platform: "reddit",
    type: classifyIntent(combined.toLowerCase()),
    title: title.slice(0, 500),
    body: selftext.slice(0, 800),
    url,
    author: String(d.author ?? "unknown"),
    subreddit: String(d.subreddit ?? subredditLabel),
    score: typeof d.score === "number" ? d.score : undefined,
    matchedKeywords: matched.slice(0, 12),
    discoveredAt: new Date().toISOString(),
  })
}

/**
 * Crawl a subreddit's /new feed (no keyword gate — all posts within the time window).
 * Uses OAuth token when available (required on Vercel — Reddit blocks anonymous cloud IPs).
 */
async function crawlSubredditPosts(
  subreddit: string,
  keywords: string[],
  cutoff: number,
  token: string | null,
): Promise<IntentSignal[]> {
  const username = process.env.REDDIT_USERNAME?.trim() || "juno_bot"
  const signals: IntentSignal[] = []
  const base = token ? REDDIT_OAUTH_BASE : REDDIT_BASE
  try {
    const url = `${base}/r/${encodeURIComponent(subreddit)}/new.json?limit=100&raw_json=1`
    const res = await fetch(url, {
      headers: redditFetchHeaders(token, username),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.warn(`[intent-monitor] crawl r/${subreddit}: HTTP ${res.status}${token ? " (OAuth)" : " (anon — set REDDIT_CLIENT_ID/SECRET)"}`)
      return []
    }
    const data = await res.json()
    for (const post of parseRedditListing(data)) {
      pushRedditPost(signals, post, keywords, "", cutoff, subreddit, true)
    }
  } catch (e) {
    console.warn(`[intent-monitor] crawl r/${subreddit}:`, e)
  }
  return signals
}

/**
 * Full-feed crawl: reads all recent posts from each subreddit within the lookback window.
 * Authenticates via Reddit OAuth (client_credentials) — required for Vercel/cloud deployments
 * where anonymous Reddit requests are blocked. Set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET.
 */
export async function crawlRedditForIntent(
  subreddits: string[],
  keywords: string[],
): Promise<IntentSignal[]> {
  const cutoff = Date.now() - getIntentLookbackMs()
  let uniqSubs = [
    ...new Set(subreddits.map((s) => s.replace(/^r\//, "").trim()).filter(Boolean)),
  ].slice(0, 12)
  if (uniqSubs.length === 0) {
    uniqSubs = [...new Set(REDDIT_SUBREDDITS.map((s) => s.toLowerCase()))].slice(0, 12)
  }

  // Fetch OAuth token once for the entire crawl batch
  const token = await getRedditAccessToken()
  if (!token) {
    console.warn("[intent-monitor] No Reddit OAuth token — REDDIT_CLIENT_ID/SECRET not set. Requests will be blocked on cloud IPs.")
  } else {
    console.log(`[intent-monitor] Reddit OAuth ready, crawling ${uniqSubs.length} subreddits.`)
  }

  const signals: IntentSignal[] = []
  for (const subreddit of uniqSubs) {
    const posts = await crawlSubredditPosts(subreddit, keywords, cutoff, token)
    signals.push(...posts)
    await sleep(300)
  }

  return deduplicateSignals(signals)
}

/**
 * Site-wide Reddit search (not restricted to one subreddit) — higher recall.
 */
async function scanRedditGlobal(
  keywords: string[],
  cutoff: number,
  redditT: ReturnType<typeof redditSearchTimeParam>,
): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = []
  const orParts = keywords
    .filter((k) => k.length > 2)
    .slice(0, 6)
    .map((k) => (k.includes(" ") ? `"${k.replace(/"/g, "")}"` : k))
  const q = orParts.join(" OR ")
  if (!q.trim()) return []

  try {
    const searchUrl = `${REDDIT_BASE}/search.json?q=${encodeURIComponent(q)}&sort=new&t=${redditT}&limit=25`
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "JunoIntentMonitor/1.0 (contact: app)" },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return []

    const data = await res.json()
    for (const post of parseRedditListing(data)) {
      pushRedditPost(signals, post, keywords, orParts[0] ?? "audit", cutoff, "search")
    }
  } catch (e) {
    console.warn("[intent-monitor] Reddit global search:", e)
  }
  return deduplicateSignals(signals)
}

/**
 * Search Reddit JSON API (read-only, User-Agent required).
 */
export async function scanRedditForIntent(
  keywords: string[],
  subreddits: string[],
): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = []
  const lookbackDays = getIntentLookbackDays()
  const redditT = redditSearchTimeParam(lookbackDays)
  const cutoff = Date.now() - getIntentLookbackMs()
  let uniqSubs = [...new Set(subreddits.map((s) => s.replace(/^r\//, "").trim()).filter(Boolean))].slice(0, 12)
  if (uniqSubs.length === 0) {
    uniqSubs = [...new Set(REDDIT_SUBREDDITS.map((s) => s.toLowerCase()))].slice(0, 12)
  }
  const kwSlice = keywords.slice(0, 12)

  for (const subreddit of uniqSubs) {
    const orChunk = kwSlice.slice(0, 5)
    const q = orChunk
      .map((k) => (k.includes(" ") ? `"${k.replace(/"/g, "")}"` : k))
      .join(" OR ")
    if (!q.trim()) continue

    try {
      const searchUrl = `${REDDIT_BASE}/r/${encodeURIComponent(subreddit)}/search.json?q=${encodeURIComponent(q)}&restrict_sr=1&sort=new&t=${redditT}&limit=20`

      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "JunoIntentMonitor/1.0 (contact: app)" },
        signal: AbortSignal.timeout(15_000),
      })

      if (!res.ok) {
        await sleep(900)
        continue
      }

      const data = await res.json()
      for (const post of parseRedditListing(data)) {
        pushRedditPost(signals, post, keywords, orChunk[0] ?? q, cutoff, subreddit)
      }
    } catch (e) {
      console.warn(`[intent-monitor] Reddit r/${subreddit}:`, e)
    }
    await sleep(1100)
  }

  const global = await scanRedditGlobal(keywords, cutoff, redditT)
  return deduplicateSignals([...signals, ...global])
}

type HnHit = {
  comment_text?: string
  story_text?: string
  title?: string
  story_title?: string
  url?: string
  author?: string
  objectID?: string
}

/**
 * HN Algolia — comments and stories within the configured lookback window.
 */
export async function scanHNForIntent(keywords: string[]): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = []
  const sinceSec = Math.floor((Date.now() - getIntentLookbackMs()) / 1000)
  const kwSlice = keywords.slice(0, 8)

  for (const keyword of kwSlice) {
    for (const mode of ["comment", "story"] as const) {
      try {
        const tagParam = mode === "comment" ? "&tags=comment" : "&tags=story"
        const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}${tagParam}&numericFilters=created_at_i>${sinceSec}`

        const res = await fetch(url, { signal: AbortSignal.timeout(14_000) })
        if (!res.ok) continue

        const data = (await res.json()) as { hits?: HnHit[] }

        for (const hit of (data.hits ?? []).slice(0, 15)) {
          const commentHtml = hit.comment_text
          const isComment =
            typeof commentHtml === "string" && commentHtml.replace(/<[^>]*>/g, " ").trim().length > 0
          const isStory = !isComment && Boolean(hit.title?.trim())

          const text = isStory
            ? `${hit.title ?? ""} ${(hit.story_text ?? "").replace(/<[^>]*>/g, " ")}`
            : (commentHtml ?? "").replace(/<[^>]*>/g, " ")
          if (!text.trim()) continue

          const matched = matchedOrSearchTerm(text, keywords, keyword)
          if (matched.length === 0) continue

          let itemUrl = "https://news.ycombinator.com"
          if (isStory && hit.url) {
            itemUrl = hit.url
          } else {
            const rawId = String(hit.objectID ?? "")
            const commentId = rawId.includes("_") ? rawId.split("_").pop() ?? rawId : rawId
            if (commentId) {
              itemUrl = `https://news.ycombinator.com/item?id=${encodeURIComponent(commentId)}`
            }
          }

          const title = isStory
            ? String(hit.title ?? "HN").slice(0, 500)
            : (hit.story_title || `HN comment by ${hit.author ?? "user"}`).slice(0, 500)

          signals.push({
            platform: "hn",
            type: classifyIntent(text.toLowerCase()),
            title,
            body: text.slice(0, 800),
            url: itemUrl,
            author: hit.author ?? "unknown",
            matchedKeywords: matched.slice(0, 12),
            discoveredAt: new Date().toISOString(),
          })
        }
      } catch (e) {
        console.warn("[intent-monitor] HN search failed:", e)
      }
      await sleep(350)
    }
    await sleep(200)
  }

  return deduplicateSignals(signals)
}

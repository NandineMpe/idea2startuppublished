import { COMPETITOR_KEYWORDS } from "@/lib/juno/intent-keywords"

const REDDIT_BASE = "https://www.reddit.com"

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
  if (st.length > 1) return [st]
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
) {
  const d = post.data
  if (!d || post.kind !== "t3") return
  const created = Number(d.created_utc)
  if (!Number.isFinite(created) || created * 1000 < cutoff) return

  const title = String(d.title ?? "")
  const selftext = String(d.selftext ?? "")
  const combined = `${title} ${selftext}`
  const matched = matchedOrSearchTerm(combined, keywords, searchTerm)
  if (matched.length === 0) return

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
 * Site-wide Reddit search (not restricted to one subreddit) — higher recall.
 */
async function scanRedditGlobal(keywords: string[], cutoff: number): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = []
  const orParts = keywords
    .filter((k) => k.length > 2)
    .slice(0, 6)
    .map((k) => (k.includes(" ") ? `"${k.replace(/"/g, "")}"` : k))
  const q = orParts.join(" OR ")
  if (!q.trim()) return []

  try {
    const searchUrl = `${REDDIT_BASE}/search.json?q=${encodeURIComponent(q)}&sort=new&t=week&limit=25`
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
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const uniqSubs = [...new Set(subreddits.map((s) => s.replace(/^r\//, "").trim()).filter(Boolean))].slice(0, 8)
  const kwSlice = keywords.slice(0, 12)

  for (const subreddit of uniqSubs) {
    const orChunk = kwSlice.slice(0, 5)
    const q = orChunk
      .map((k) => (k.includes(" ") ? `"${k.replace(/"/g, "")}"` : k))
      .join(" OR ")
    if (!q.trim()) continue

    try {
      const searchUrl = `${REDDIT_BASE}/r/${encodeURIComponent(subreddit)}/search.json?q=${encodeURIComponent(q)}&restrict_sr=1&sort=new&t=week&limit=20`

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

  const global = await scanRedditGlobal(keywords, cutoff)
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
 * HN Algolia — comments and stories from the last ~7 days.
 */
export async function scanHNForIntent(keywords: string[]): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = []
  const sinceSec = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
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

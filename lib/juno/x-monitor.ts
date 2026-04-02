import { classifyIntent, deduplicateSignals, type IntentSignal } from "@/lib/juno/intent-monitor"
import { normalizeXWatchTerms } from "@/lib/juno/x-watchlist"

const X_RECENT_SEARCH_URL = "https://api.x.com/2/tweets/search/recent"

type XPost = {
  id?: string
  text?: string
  author_id?: string
  created_at?: string
  public_metrics?: {
    like_count?: number
    retweet_count?: number
    reply_count?: number
    quote_count?: number
  }
}

type XUser = {
  id?: string
  name?: string
  username?: string
}

type XRecentSearchResponse = {
  data?: XPost[]
  includes?: {
    users?: XUser[]
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getXBearerToken(): string {
  return process.env.X_BEARER_TOKEN?.trim() || ""
}

export function hasXRecentSearchConfig(): boolean {
  return Boolean(getXBearerToken())
}

function quoteTerm(term: string): string {
  const cleaned = term.replace(/"/g, "").trim()
  if (!cleaned) return ""
  return /\s/.test(cleaned) ? `"${cleaned}"` : cleaned
}

function buildRecentSearchQuery(term: string): string {
  const needle = quoteTerm(term)
  const buying = [
    "need",
    "\"looking for\"",
    "recommend",
    "replacing",
    "alternative",
    "alternatives",
    "problem",
    "broken",
    "frustrating",
    "struggling",
    "workflow",
    "tool",
    "platform",
  ].join(" OR ")

  return `${needle} (${buying}) lang:en -is:retweet`
}

function buildPostUrl(id: string, username: string | null): string {
  if (username) {
    return `https://x.com/${encodeURIComponent(username)}/status/${encodeURIComponent(id)}`
  }
  return `https://x.com/i/web/status/${encodeURIComponent(id)}`
}

function scoreEngagement(metrics: XPost["public_metrics"]): number {
  if (!metrics) return 0
  return (
    Number(metrics.like_count ?? 0) +
    Number(metrics.reply_count ?? 0) * 2 +
    Number(metrics.retweet_count ?? 0) * 2 +
    Number(metrics.quote_count ?? 0) * 2
  )
}

export async function scanXForIntent(terms: string[]): Promise<IntentSignal[]> {
  const bearerToken = getXBearerToken()
  if (!bearerToken) return []

  const watchTerms = normalizeXWatchTerms(terms).slice(0, 10)
  if (watchTerms.length === 0) return []

  const signals: IntentSignal[] = []

  for (const term of watchTerms) {
    const params = new URLSearchParams({
      query: buildRecentSearchQuery(term),
      max_results: "10",
      expansions: "author_id",
      "tweet.fields": "created_at,author_id,public_metrics",
      "user.fields": "name,username",
    })

    try {
      const res = await fetch(`${X_RECENT_SEARCH_URL}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        signal: AbortSignal.timeout(15_000),
      })

      if (!res.ok) {
        console.warn(`[x-monitor] recent search failed for "${term}":`, res.status)
        await sleep(500)
        continue
      }

      const payload = (await res.json()) as XRecentSearchResponse
      const users = new Map<string, XUser>(
        (payload.includes?.users ?? [])
          .filter((user): user is XUser & { id: string } => typeof user.id === "string" && user.id.length > 0)
          .map((user) => [user.id, user]),
      )

      for (const post of payload.data ?? []) {
        const id = String(post.id ?? "").trim()
        const text = String(post.text ?? "").trim()
        if (!id || !text) continue

        const author = users.get(String(post.author_id ?? ""))
        const username = typeof author?.username === "string" ? author.username : null
        const authorLabel =
          username ||
          (typeof author?.name === "string" && author.name.trim().length > 0 ? author.name.trim() : "unknown")

        signals.push({
          platform: "x",
          type: classifyIntent(text),
          title: text.replace(/\s+/g, " ").slice(0, 160),
          body: text.slice(0, 800),
          url: buildPostUrl(id, username),
          author: authorLabel,
          score: scoreEngagement(post.public_metrics),
          matchedKeywords: [term],
          discoveredAt: post.created_at ?? new Date().toISOString(),
        })
      }
    } catch (error) {
      console.warn(`[x-monitor] recent search errored for "${term}":`, error)
    }

    await sleep(550)
  }

  return deduplicateSignals(signals)
}


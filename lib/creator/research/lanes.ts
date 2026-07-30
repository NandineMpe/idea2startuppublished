import { fetchRssLikeSource } from "@/lib/careeros/sources/feed-utils"
import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"

/**
 * Where the Researcher looks.
 *
 * News alone produces the same theses every commentator in the niche will file
 * that week. The edge comes from reading across registers that rarely meet:
 * a preprint that contradicts the press release, a book-length argument the
 * news cycle has forgotten, a lab's own release notes versus how they were
 * reported.
 *
 * Each lane is tagged on the signal so synthesis can prefer connections that
 * cross lanes — a paper plus a news item is a stronger dot-join than two
 * headlines about the same event.
 */

export type ResearchLane = "news" | "papers" | "releases" | "books" | "discussion"

/** Where a topic sits relative to the creator: proven ground, or the stretch. */
export type TopicStance = "core" | "adjacent"

export type LaneSignal = RawFeedItem & {
  lane: ResearchLane
  stance: TopicStance
  topic: string
}

const UA = "Juno Creator OS Research (contact: nandini@augentik.com)"

function tag(items: RawFeedItem[], lane: ResearchLane, stance: TopicStance, topic: string): LaneSignal[] {
  return items.map((item) => ({ ...item, lane, stance, topic }))
}

// ---------------------------------------------------------------------------
// News — what the cycle is saying right now.
// ---------------------------------------------------------------------------

async function fetchNews(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const q = encodeURIComponent(topic)
  return fetchRssLikeSource({
    sourceKey: `news:${slug(topic)}`,
    url: `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
    hoursBack,
  })
}

// ---------------------------------------------------------------------------
// Papers — arXiv returns Atom, so the existing RSS parser handles it.
// Preprints are where a claim appears months before the news notices.
// ---------------------------------------------------------------------------

async function fetchPapers(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const q = encodeURIComponent(`all:"${topic}"`)
  return fetchRssLikeSource({
    sourceKey: `papers:${slug(topic)}`,
    // https, not http: plain-HTTP outbound fails in some serverless runtimes,
    // and the failure was invisible behind a per-lane catch.
    url: `https://export.arxiv.org/api/query?search_query=${q}&sortBy=submittedDate&sortOrder=descending&max_results=12`,
    // arXiv dates are submission dates; a tight window returns nothing useful.
    hoursBack: Math.max(hoursBack, 24 * 21),
  })
}

// ---------------------------------------------------------------------------
// Releases — what the labs themselves published, unmediated by coverage.
// Reuses the CareerOS feed adapters rather than re-deriving the URLs.
// ---------------------------------------------------------------------------

const RELEASE_FEEDS: Array<{ key: string; url: string }> = [
  { key: "openai", url: "https://openai.com/news/rss.xml" },
  { key: "anthropic", url: "https://www.anthropic.com/news/rss.xml" },
  { key: "deepmind", url: "https://deepmind.google/blog/rss.xml" },
  { key: "huggingface", url: "https://huggingface.co/blog/feed.xml" },
  { key: "microsoft-ai", url: "https://blogs.microsoft.com/ai/feed/" },
]

export async function fetchReleases(hoursBack: number): Promise<LaneSignal[]> {
  const out: LaneSignal[] = []
  for (const feed of RELEASE_FEEDS) {
    try {
      const items = await fetchRssLikeSource({
        sourceKey: `releases:${feed.key}`,
        url: feed.url,
        hoursBack,
      })
      out.push(...tag(items, "releases", "core", feed.key))
    } catch {
      // One dead feed must not sink the sweep.
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Books — the long-form argument the news cycle has no room for. Open Library
// is free and keyless; recent publications only, so this surfaces what is
// entering the conversation rather than the canon everyone has already cited.
// ---------------------------------------------------------------------------

async function fetchBooks(topic: string): Promise<RawFeedItem[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(topic)}&sort=new&limit=6&fields=title,author_name,first_publish_year,key,subject`
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store" })
    if (!res.ok) return []
    const data = (await res.json()) as {
      docs?: Array<{
        title?: string
        author_name?: string[]
        first_publish_year?: number
        key?: string
        subject?: string[]
      }>
    }
    const thisYear = new Date().getFullYear()
    return (data.docs ?? [])
      .filter((d) => d.title && d.key)
      // Only recent work: older titles are reference, not news.
      .filter((d) => !d.first_publish_year || d.first_publish_year >= thisYear - 2)
      .map((d) => ({
        source_key: `books:${slug(topic)}`,
        source_item_id: `https://openlibrary.org${d.key}`,
        title: d.title!,
        body: [
          d.author_name?.length ? `By ${d.author_name.slice(0, 3).join(", ")}.` : "",
          d.first_publish_year ? `Published ${d.first_publish_year}.` : "",
          d.subject?.length ? `Subjects: ${d.subject.slice(0, 8).join(", ")}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
        url: `https://openlibrary.org${d.key}`,
        published_at: new Date(d.first_publish_year ? `${d.first_publish_year}-01-01` : Date.now()),
        authors: d.author_name?.slice(0, 3) ?? [],
        raw_payload: { open_library_key: d.key, subjects: d.subject?.slice(0, 12) ?? [] },
      }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Discussion — where practitioners argue before it reaches the press.
// ---------------------------------------------------------------------------

async function fetchDiscussion(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const q = encodeURIComponent(topic)
  // A low points floor on purpose: 20+ filters a broad term like "AI" fine but
  // returns nothing for a specific one, and specific is the whole point here.
  // Practitioner argument on a niche topic rarely reaches the front page.
  return fetchRssLikeSource({
    sourceKey: `discussion:${slug(topic)}`,
    url: `https://hnrss.org/newest?q=${q}&points=5`,
    hoursBack,
  })
}

function slug(topic: string): string {
  return topic.toLowerCase().trim().replace(/\s+/g, "-").slice(0, 48)
}

/**
 * Sweep every lane for one topic. Failures are swallowed per lane: a sweep that
 * returns four lanes is far more useful than one that returns nothing because
 * arXiv was briefly down.
 */
export type LaneOutcome = { signals: LaneSignal[]; errors: string[] }

export async function sweepTopicAcrossLanes(
  topic: string,
  stance: TopicStance,
  hoursBack: number,
): Promise<LaneOutcome> {
  const errors: string[] = []

  /**
   * Per-lane isolation, but never silent: an empty lane and a broken lane look
   * identical in the output, and the first version of this swallowed the
   * difference — which hid four dead lanes behind a working news feed.
   */
  async function lane<T>(name: ResearchLane, fn: () => Promise<T[]>): Promise<T[]> {
    try {
      const out = await fn()
      if (!out.length) errors.push(`${name}: returned 0 items`)
      return out
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`)
      return []
    }
  }

  const [news, papers, books, discussion] = await Promise.all([
    lane("news", () => fetchNews(topic, hoursBack)),
    lane("papers", () => fetchPapers(topic, hoursBack)),
    lane("books", () => fetchBooks(topic)),
    lane("discussion", () => fetchDiscussion(topic, hoursBack)),
  ])

  return {
    signals: [
      ...tag(news.slice(0, 10), "news", stance, topic),
      ...tag(papers.slice(0, 6), "papers", stance, topic),
      ...tag(books.slice(0, 4), "books", stance, topic),
      ...tag(discussion.slice(0, 5), "discussion", stance, topic),
    ],
    errors,
  }
}

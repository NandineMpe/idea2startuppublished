import { fetchRssLikeSource } from "@/lib/careeros/sources/feed-utils"
import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"
import { PRIMARY_ADAPTERS } from "./primary"
import { EXTENDED_ADAPTERS } from "./primary-extended"
import { FRONTIER_ADAPTERS } from "./frontier"

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

export type ResearchLane =
  // Secondary: someone writing about what happened.
  | "news"
  | "books"
  | "discussion"
  // Primary: the document itself.
  | "papers"
  | "releases"
  | "patents"
  | "filings"
  | "courts"
  | "funding"
  | "regulation"
  | "standards"
  | "code"
  | "models"
  | "jobs"
  | "scholarship"
  | "inspections"
  | "consultations"
  | "supervisors"
  | "procurement"
  | "conferences"
  | "retractions"
  | "syscards"
  | "changelogs"
  | "ventures"
  | "grants"
  | "solicitations"

/** The lanes that hold documents rather than coverage of documents. */
export const PRIMARY_LANES: ResearchLane[] = [
  "papers",
  "releases",
  "patents",
  "filings",
  "courts",
  "funding",
  "regulation",
  "standards",
  "code",
  "models",
  "jobs",
  "scholarship",
  "inspections",
  "consultations",
  "supervisors",
  "procurement",
  "conferences",
  "retractions",
  "syscards",
  "changelogs",
  "ventures",
  "grants",
  "solicitations",
]

/** Where a topic sits relative to the creator: proven ground, or the stretch. */
export type TopicStance = "core" | "adjacent" | "horizon"

export type LaneSignal = RawFeedItem & {
  lane: ResearchLane
  stance: TopicStance
  topic: string
}

const UA = "Juno Creator OS Research (contact: nandini@augentik.com)"

const STOPWORDS = new Set([
  "the", "and", "for", "with", "how", "why", "what", "who", "are", "was", "were",
  "from", "into", "about", "that", "this", "these", "those", "your", "you", "its",
  "using", "use", "used", "new", "more", "most", "can", "will", "study", "report",
  "research", "paper", "analysis", "based", "towards", "toward", "via",
])

export function meaningfulTokens(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !STOPWORDS.has(w)),
    ),
  ]
}

/**
 * Keep only results that are actually about the query.
 *
 * arXiv's `all:` matches full text including references, so a paper can satisfy
 * an AND of terms while being about something else entirely — a search for
 * chatbot dependence returned a paper on avian bone classification. An
 * irrelevant paper is worse than none, because it reaches synthesis and gets
 * cited as a receipt in a dossier.
 *
 * Matching is on title and summary only, and demands two distinct query terms
 * (one when the query itself is that short), which is strict enough to drop the
 * bird bones and loose enough to keep papers phrased differently to the query.
 */
export function filterByRelevance(items: RawFeedItem[], query: string): RawFeedItem[] {
  const wanted = meaningfulTokens(query)
  if (!wanted.length) return items
  const required = wanted.length <= 2 ? 1 : 2

  return items.filter((item) => {
    const haystack = meaningfulTokens(`${item.title} ${item.body ?? ""}`)
    const hits = wanted.filter((w) =>
      haystack.some((h) => h === w || (w.length >= 5 && h.startsWith(w.slice(0, 5)))),
    ).length
    return hits >= required
  })
}

/**
 * Turn a canon topic label into search queries.
 *
 * Canon labels are editorial phrases written to read well on the Canon screen
 * — "AI accountability, lawsuits & copyright", "Big Four, audit & accounting
 * disruption". Handed to a search API verbatim they return nothing at all, in
 * every lane including news, because no document contains that exact compound.
 *
 * Splitting on the separators recovers the searchable parts, and short
 * fragments are re-anchored to the label's leading term so "copyright" does not
 * go out unqualified and drag back the whole of copyright law.
 */
export function topicToQueries(label: string): string[] {
  const cleaned = label.replace(/\s+/g, " ").trim()
  if (!cleaned) return []

  const fragments = cleaned
    .split(/[,;&/]|\band\b/i)
    .map((f) => f.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim())
    .filter((f) => f.length > 2)

  if (fragments.length <= 1) return [cleaned.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim()]

  // The first fragment carries the domain ("AI accountability" -> "AI").
  const anchor = fragments[0].split(" ")[0]
  const queries = fragments.map((fragment, i) => {
    if (i === 0) return fragment
    const words = fragment.split(" ")
    // Re-anchor only genuinely bare fragments; leave specific ones alone.
    return words.length <= 2 && !fragment.toLowerCase().includes(anchor.toLowerCase())
      ? `${anchor} ${fragment}`
      : fragment
  })

  return [...new Set(queries)].slice(0, 3)
}

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

/**
 * arXiv hosts every discipline, so an unscoped term search returns particle
 * physics for "accountability". Constraining to the CS categories that actually
 * carry this material — AI, computers-and-society, ML, language, crypto/security
 * — is the difference between a relevant paper and noise that pollutes synthesis.
 */
const ARXIV_CATEGORIES = "cat:cs.AI+OR+cat:cs.CY+OR+cat:cs.LG+OR+cat:cs.CL+OR+cat:cs.CR"

async function fetchPapers(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  // AND of terms rather than an exact phrase: arXiv titles rarely echo a topic
  // verbatim. Two-character tokens are kept — "AI" and "EU" are load-bearing.
  const terms = topic
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 3)
    .map((w) => `all:${encodeURIComponent(w)}`)
    .join("+AND+")
  const q = terms ? `(${ARXIV_CATEGORIES})+AND+${terms}` : ARXIV_CATEGORIES
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
  // The label is for reading; the queries are for searching. Each lane runs the
  // derived queries and the results are pooled under the original topic.
  const queries = topicToQueries(topic)
  if (!queries.length) return { signals: [], errors: [`${topic}: produced no searchable query`] }

  /**
   * Per-lane isolation, but never silent: an empty lane and a broken lane look
   * identical in the output, and the first version of this swallowed the
   * difference — which hid four dead lanes behind a working news feed.
   */
  /** Run a lane across every derived query and pool the results. */
  async function across(
    name: ResearchLane,
    fn: (q: string) => Promise<RawFeedItem[]>,
  ): Promise<RawFeedItem[]> {
    const results = await Promise.all(
      queries.map((q) =>
        fn(q).catch((e) => {
          errors.push(`${name} [${q}]: ${e instanceof Error ? e.message : String(e)}`)
          return [] as RawFeedItem[]
        }),
      ),
    )
    const pooled = results.flat()
    // De-duplicate: derived queries overlap by design.
    const seen = new Set<string>()
    const unique = pooled.filter((item) => {
      if (seen.has(item.source_item_id)) return false
      seen.add(item.source_item_id)
      return true
    })
    if (!unique.length) errors.push(`${name}: 0 items across ${queries.length} quer${queries.length === 1 ? "y" : "ies"}`)
    return unique
  }

  /**
   * Primary adapters run once on the raw topic rather than across the derived
   * queries. Each one already extracts its own key terms, because EDGAR, GitHub
   * and the Federal Register all want different query shapes, so fanning the
   * derived queries into them would be eight redundant calls per query for no
   * extra coverage.
   */
  const ALL_PRIMARY = { ...PRIMARY_ADAPTERS, ...EXTENDED_ADAPTERS, ...FRONTIER_ADAPTERS }

  async function primary(name: keyof typeof ALL_PRIMARY): Promise<LaneSignal[]> {
    try {
      const items = await ALL_PRIMARY[name](topic, hoursBack)
      if (!items.length) errors.push(`${name}: 0 items`)
      return tag(items, name as ResearchLane, stance, topic)
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`)
      return []
    }
  }

  const [news, papers, books, discussion, primaries] = await Promise.all([
    // News search already ranks by relevance; the others match too loosely.
    across("news", (q) => fetchNews(q, hoursBack)),
    across("papers", async (q) => filterByRelevance(await fetchPapers(q, hoursBack), q)),
    across("books", async (q) => filterByRelevance(await fetchBooks(q), q)),
    across("discussion", (q) => fetchDiscussion(q, hoursBack)),
    Promise.all(
      (Object.keys(ALL_PRIMARY) as Array<keyof typeof ALL_PRIMARY>).map((name) => primary(name)),
    ).then((groups) => groups.flat()),
  ])

  return {
    signals: [
      // Primary first: position in this list is a weighting, and the documents
      // are the reason the desk exists.
      ...primaries,
      ...tag(papers.slice(0, 6), "papers", stance, topic),
      ...tag(news.slice(0, 8), "news", stance, topic),
      ...tag(books.slice(0, 3), "books", stance, topic),
      ...tag(discussion.slice(0, 4), "discussion", stance, topic),
    ],
    errors,
  }
}

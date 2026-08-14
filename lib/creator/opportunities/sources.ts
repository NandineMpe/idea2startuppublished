import { fetchRssLikeSource } from "@/lib/careeros/sources/feed-utils"
import type { OpportunityCandidate } from "./hunt"

/**
 * Keyless opportunity sources.
 *
 * The desk used to find opportunities by asking a search index about them. That
 * put a paid dependency in front of every lane, and when the credit ran out the
 * whole desk went quiet without failing: searches returned empty arrays, the
 * sweep proposed nothing, and nothing anywhere said why.
 *
 * These read the registers directly instead. It is a better architecture than
 * search for this particular job, not merely a cheaper one:
 *
 *  - A funder publishes its calls. There is no ranking to argue with, no
 *    recency heuristic, and a deadline is a field rather than a sentence a model
 *    has to find in prose and hope it read correctly.
 *  - Coverage is complete rather than top-N. A search index shows the ten most
 *    relevant calls; the register has all of them, so a small call in the right
 *    programme is not buried under a large one in the wrong one.
 *  - Nothing silently degrades. A register that moves returns a 404, which is
 *    loud, rather than zero results, which looks like a quiet week.
 */

const UA = "Mozilla/5.0 (compatible; JunoCreatorOS/1.0; +https://usejuno-ai.com) research-desk"

/** Distinctive words from a topic, for filtering a register that has no topic filter of its own. */
export function topicMatchers(topics: string[]): string[] {
  const stop = new Set([
    "the", "and", "for", "with", "from", "into", "that", "this", "your", "how",
    "artificial", "intelligence", "professional", "services", "technology",
    "digital", "data", "systems", "research", "enterprise", "based", "using",
  ])
  const out = new Set<string>()
  for (const topic of topics) {
    const lower = topic.toLowerCase()
    for (const phrase of ["artificial intelligence", "machine learning", "generative ai", "large language model"]) {
      if (lower.includes(phrase)) out.add(phrase)
    }
    if (/\bai\b/.test(lower)) out.add("ai")
    for (const word of lower.split(/[^a-z0-9]+/)) {
      if (word.length > 3 && !stop.has(word)) out.add(word)
    }
  }
  return [...out]
}

/** Whole-word containment, so "ai" does not match "said" and "audit" does not match "auditorium". */
function mentions(haystack: string, terms: string[]): boolean {
  const lower = ` ${haystack.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `
  return terms.some((t) => lower.includes(` ${t} `))
}

/**
 * Relevance judged on the TITLE, not the body.
 *
 * Body matching looked reasonable and was not. Every technology publication
 * mentions AI somewhere in every article, so a body filter passed a piece about
 * violent cargo theft and another about Medicaid funding, both of which
 * genuinely contained the term. A funder or an editor that means to be about
 * this subject says so in the name of the thing.
 *
 * The same rule fixes the EU register, whose own text ranking put wind turbines
 * and marine biology above an AI call in a search for artificial intelligence.
 */
function titleIsAbout(title: string, terms: string[]): boolean {
  return mentions(title, terms)
}

// ---------------------------------------------------------------------------
// EU: the official Funding and Tenders register.
// ---------------------------------------------------------------------------

/**
 * The EU portal's own search backend, filtered the way the portal filters it.
 *
 * This endpoint looks broken until you send it correctly, and the failure is
 * silent, which is why an earlier attempt wrote it off. Passing `query` as a
 * plain form field is accepted and then ignored: the response is HTTP 200 with
 * every document in the portal, ranked so that closed Horizon 2020 calls from
 * 2018 and FAQ pages outrank anything live. A hundred rows yielded two open
 * calls, both the same one twice.
 *
 * The parts have to be sent as FILES, not strings. Do that and the same
 * endpoint returns 1,240 open calls instead of 69,739 documents, every one with
 * a real identifier and a real deadline.
 *
 *   type   1 = grants, 2 = tenders
 *   status 31094501 = forthcoming, 31094502 = open
 */
const SEDIA_ENDPOINT = "https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA"

type SediaResult = {
  url?: string
  metadata?: Record<string, string[] | undefined>
}

export async function fetchEuCalls(topics: string[]): Promise<OpportunityCandidate[]> {
  const out: OpportunityCandidate[] = []
  const seen = new Set<string>()
  const now = Date.now()
  // The portal's own relevance ranking is weak: a search for artificial
  // intelligence returns wind turbine and marine biology calls above an AI one.
  // The register is authoritative about WHAT IS OPEN and unreliable about what
  // is relevant, so the filter belongs on this side.
  const terms = [
    ...topicMatchers(topics),
    "ai", "artificial intelligence", "media", "journalism", "audiovisual", "creator", "content",
  ]

  // Two passes with different vocabulary. Research funding and media funding
  // share almost no words, and a creator who is both a builder and a publisher
  // is eligible under both, so one query would always miss half of it.
  const queries = [...topics.slice(0, 2), "media journalism audiovisual creator"]

  for (const text of queries) {
    try {
      const query = {
        bool: {
          must: [
            { terms: { type: ["1"] } },
            { terms: { status: ["31094501", "31094502"] } },
          ],
        },
      }
      const form = new FormData()
      const part = (value: unknown, name: string) =>
        new Blob([JSON.stringify(value)], { type: "application/json" })
      form.append("query", part(query, "query"), "query.json")
      form.append("languages", part(["en"], "languages"), "languages.json")
      form.append("sort", part({ field: "sortStatus", order: "ASC" }, "sort"), "sort.json")

      const res = await fetch(
        `${SEDIA_ENDPOINT}&text=${encodeURIComponent(text)}&pageSize=15&pageNumber=1`,
        { method: "POST", headers: { "User-Agent": UA }, body: form },
      )
      if (!res.ok) {
        console.warn(`[creator-opportunities] EU portal HTTP ${res.status}`)
        continue
      }
      const data = (await res.json()) as { results?: SediaResult[] }

      for (const row of data.results ?? []) {
        const m = row.metadata ?? {}
        const identifier = m.identifier?.[0] ?? ""
        const title = m.title?.[0]
        if (!title || seen.has(identifier || title)) continue
        if (!titleIsAbout(title, terms)) continue

        const deadlineRaw = m.deadlineDate?.[0]
        const deadline = deadlineRaw ? new Date(deadlineRaw) : null
        // A call whose deadline has passed is not a weaker opportunity, it is
        // none, and the register does still carry a handful of them.
        if (deadline && deadline.getTime() < now) continue
        seen.add(identifier || title)

        // The register hands back the topic-details page, which is the page
        // carrying the Start Submission button, the full call document and the
        // partner search. It is the apply link, so it is used as one rather
        // than a URL being constructed from the identifier.
        const topicUrl =
          row.url ??
          (identifier
            ? `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${identifier.toLowerCase()}`
            : "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home")

        out.push({
          lane: "grants",
          title: `${title}${identifier ? ` (${identifier})` : ""}`,
          url: topicUrl,
          apply_url: topicUrl,
          evidence: `European Union funding call${identifier ? ` ${identifier}` : ""}, published on the Funding and Tenders portal and currently ${
            m.status?.[0] === "31094501" ? "forthcoming" : "open"
          }. ${deadline ? `Closes ${deadline.toISOString().slice(0, 10)}.` : "No deadline published yet."} Programme: ${
            m.frameworkProgramme?.[0] ?? m.programmePeriod?.[0] ?? "see call"
          }.`,
          deadline: deadline ? deadline.toISOString().slice(0, 10) : null,
        })
      }
    } catch (e) {
      console.warn("[creator-opportunities] EU portal failed:", e instanceof Error ? e.message : e)
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// UK and Ireland: opportunity feeds published by the funders themselves.
// ---------------------------------------------------------------------------

/**
 * Feeds that publish funding calls rather than news about funding.
 *
 * Deliberately short. Every entry here was fetched and read before it was
 * added, because a plausible-looking feed URL that 404s is indistinguishable
 * from a quiet week once it is inside a try/catch, and the last thing this desk
 * needs is another dependency that fails silently.
 */
const FUNDER_FEEDS: Array<{ key: string; url: string; label: string }> = [
  { key: "ukri", url: "https://www.ukri.org/opportunity/feed/", label: "UK Research and Innovation" },
]

export async function fetchFunderFeeds(topics: string[]): Promise<OpportunityCandidate[]> {
  const terms = topicMatchers(topics)
  const out: OpportunityCandidate[] = []

  for (const feed of FUNDER_FEEDS) {
    try {
      const items = await fetchRssLikeSource({
        sourceKey: `grants:${feed.key}`,
        url: feed.url,
        // Funding calls are open for months, so a tight window would drop
        // everything still live but announced in the spring.
        hoursBack: 24 * 240,
      })
      for (const item of items) {
        if (!titleIsAbout(item.title, terms)) continue
        out.push({
          lane: "grants",
          title: `${item.title} (${feed.label})`,
          url: item.url,
          // The funder's own opportunity page carries the eligibility, the
          // closing date and the start-application route. There is nothing
          // better to point at and nothing to construct.
          apply_url: item.url,
          evidence: `${feed.label} funding opportunity, announced ${item.published_at.toISOString().slice(0, 10)}. ${item.body.slice(0, 400)}`,
          deadline: null,
        })
      }
    } catch (e) {
      console.warn(`[creator-opportunities] ${feed.key} feed failed:`, e instanceof Error ? e.message : e)
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Events: an open dataset of conferences, with the CFP deadline attached.
// ---------------------------------------------------------------------------

type ConfsTechEntry = {
  name?: string
  url?: string
  startDate?: string
  city?: string
  country?: string
  online?: boolean
  cfpUrl?: string
  cfpEndDate?: string
}

/**
 * confs.tech, an openly maintained dataset of technology conferences.
 *
 * Better than searching for a call for papers, because the CFP closing date is
 * a field. A ranked search result about a conference tells you the conference
 * exists; this tells you whether you can still get on the stage, which is the
 * only part that decides anything.
 */
const CONFS_TECH_TOPICS = ["data", "general", "leadership", "security", "python", "javascript"]

export async function fetchConferenceCalls(markets: string[]): Promise<OpportunityCandidate[]> {
  const year = new Date().getFullYear()
  const out: OpportunityCandidate[] = []
  const now = Date.now()
  const wantsUs = markets.some((m) => /united states|usa|america/i.test(m))

  for (const year_ of [year, year + 1]) {
    for (const topic of CONFS_TECH_TOPICS) {
      try {
        const res = await fetch(
          `https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/${year_}/${topic}.json`,
          { headers: { "User-Agent": UA } },
        )
        // Next year's files do not exist until somebody adds one. That is a
        // normal state, not an error.
        if (!res.ok) continue
        const entries = (await res.json()) as ConfsTechEntry[]

        for (const entry of entries) {
          if (!entry.name || !entry.cfpUrl || !entry.cfpEndDate) continue
          const closes = new Date(entry.cfpEndDate)
          if (Number.isNaN(closes.getTime()) || closes.getTime() < now) continue

          const where = entry.online
            ? "online"
            : [entry.city, entry.country].filter(Boolean).join(", ") || "location not stated"
          // A stage in the wrong market is a flight and a week for an audience
          // that will never buy, so a US-focused creator gets US and online
          // first rather than whatever the dataset happens to list.
          const inTargetMarket =
            entry.online ||
            !wantsUs ||
            /united states|usa|us$/i.test(entry.country ?? "") ||
            markets.some((m) => new RegExp(m.replace(/[^a-z ]/gi, ""), "i").test(entry.country ?? ""))
          if (!inTargetMarket) continue

          out.push({
            lane: "events",
            title: `${entry.name} — call for speakers`,
            url: entry.cfpUrl,
            // cfpUrl IS the submission form. That is the whole value of this
            // dataset over a search result about the same conference.
            apply_url: entry.cfpUrl,
            evidence: `Conference on ${entry.startDate ?? "a date not yet stated"}, ${where}. The call for speakers closes ${entry.cfpEndDate}. Conference site: ${entry.url ?? "not listed"}.`,
            deadline: entry.cfpEndDate,
          })
        }
      } catch (e) {
        console.warn(`[creator-opportunities] confs.tech ${topic} failed:`, e instanceof Error ? e.message : e)
      }
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// US media: read what the publishers publish.
// ---------------------------------------------------------------------------

/**
 * Feeds from titles the target market actually reads.
 *
 * These do not surface "write for us" pages, and that is the honest limit of
 * this lane: a feed carries articles, not submission guidelines. What it does
 * carry is what each title is currently covering, which is the thing that
 * decides whether a pitch lands. An editor commissions against their own run of
 * coverage, so a pitch that answers a question TechCrunch raised on Tuesday is
 * a different proposition from a cold one.
 */
const US_MEDIA_FEEDS: Array<{ key: string; url: string; label: string }> = [
  { key: "techcrunch", url: "https://techcrunch.com/feed/", label: "TechCrunch" },
  { key: "wired-business", url: "https://www.wired.com/feed/category/business/latest/rss", label: "Wired Business" },
  { key: "axios", url: "https://api.axios.com/feed/", label: "Axios" },
]

/**
 * Marketing and creator-economy trade press.
 *
 * The replacement for asking a search index who is sponsoring in this niche.
 * These titles report campaigns by name, which is the same signal the search
 * lane was reaching for and arrives without a ranking in the way. It is a
 * weaker signal than a search across TikTok's own disclosure wording, and that
 * is an honest trade: the disclosure route needed a paid index, and a lane that
 * silently returns nothing is worth less than a narrower one that works.
 */
const TRADE_PRESS_FEEDS: Array<{ key: string; url: string; label: string }> = [
  { key: "ppcland", url: "https://ppc.land/rss/", label: "PPC Land" },
  { key: "marketingdive", url: "https://www.marketingdive.com/feeds/news/", label: "Marketing Dive" },
  { key: "socialmediatoday", url: "https://www.socialmediatoday.com/feeds/news/", label: "Social Media Today" },
]

export async function fetchSponsorSignals(topics: string[]): Promise<OpportunityCandidate[]> {
  const terms = [...topicMatchers(topics), "creator", "influencer", "sponsorship", "campaign", "brand"]
  const out: OpportunityCandidate[] = []

  for (const feed of TRADE_PRESS_FEEDS) {
    try {
      const items = await fetchRssLikeSource({
        sourceKey: `sponsors:${feed.key}`,
        url: feed.url,
        hoursBack: 24 * 30,
      })
      for (const item of items.filter((i) => titleIsAbout(i.title, terms)).slice(0, 5)) {
        out.push({
          lane: "sponsors",
          title: item.title,
          url: item.url,
          evidence: `${feed.label}, ${item.published_at.toISOString().slice(0, 10)}. ${item.body.slice(0, 400)}`,
          deadline: null,
        })
      }
    } catch (e) {
      console.warn(`[creator-opportunities] ${feed.key} feed failed:`, e instanceof Error ? e.message : e)
    }
  }

  return out
}

export async function fetchUsMediaCoverage(topics: string[]): Promise<OpportunityCandidate[]> {
  const terms = topicMatchers(topics)
  const out: OpportunityCandidate[] = []

  for (const feed of US_MEDIA_FEEDS) {
    try {
      const items = await fetchRssLikeSource({
        sourceKey: `media:${feed.key}`,
        url: feed.url,
        hoursBack: 24 * 21,
      })
      const hits = items.filter((i) => titleIsAbout(i.title, terms)).slice(0, 4)
      for (const item of hits) {
        out.push({
          lane: "media",
          title: `${feed.label} is covering: ${item.title}`,
          url: item.url,
          evidence: `${feed.label} published this on ${item.published_at.toISOString().slice(0, 10)}, which shows what their desk is commissioning on right now. ${item.body.slice(0, 300)}`,
          deadline: null,
        })
      }
    } catch (e) {
      console.warn(`[creator-opportunities] ${feed.key} feed failed:`, e instanceof Error ? e.message : e)
    }
  }

  return out
}

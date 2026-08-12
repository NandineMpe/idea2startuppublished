import Exa from "exa-js"

/**
 * The Opportunities agent's hunting lanes. Each lane returns raw candidates as
 * evidence snippets; ranking, dedupe and pitch drafting happen in one Claude
 * pass in the sweep function, so lanes stay dumb and cheap.
 *
 * Lanes:
 *  - sponsors: who is already paying creators in this niche (warmest signal)
 *  - events:   speaking slots, panels, podcast guesting in the niche
 *  - apollo:   companies in the topic space via Apollo.io — gated on
 *              APOLLO_API_KEY; skipped silently when absent
 */

export type OpportunityCandidate = {
  lane: "sponsors" | "events" | "apollo" | "grants" | "media"
  title: string
  url: string | null
  evidence: string
  /** Set by lanes that carry a real closing date. A grant is only an opportunity until then. */
  deadline?: string | null
}

function getExa(): Exa | null {
  const key = process.env.EXA_API?.trim() || process.env.EXA_API_KEY?.trim()
  if (!key) return null
  return new Exa(key)
}

/** ISO date N days ago, for constraining a search to recently published pages. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10)
}

type SearchOptions = {
  /** Only pages published within this window. Without it the index happily
   *  returns a conference that closed last year, which is worse than nothing. */
  withinDays?: number
  includeDomains?: string[]
  excludeDomains?: string[]
}

async function exaSearch(
  exa: Exa,
  lane: OpportunityCandidate["lane"],
  query: string,
  numResults: number,
  options: SearchOptions = {},
): Promise<OpportunityCandidate[]> {
  try {
    const res = await exa.searchAndContents(query, {
      numResults,
      text: { maxCharacters: 1500 },
      type: "auto",
      startPublishedDate: daysAgo(options.withinDays ?? 120),
      ...(options.includeDomains?.length ? { includeDomains: options.includeDomains } : {}),
      ...(options.excludeDomains?.length ? { excludeDomains: options.excludeDomains } : {}),
    })
    return (res.results ?? [])
      .filter((r) => typeof r.url === "string" && typeof r.title === "string" && r.title.trim())
      .map((r) => ({
        lane,
        title: r.title!.trim(),
        url: r.url,
        evidence: typeof r.text === "string" ? r.text.trim().slice(0, 800) : "",
      }))
  } catch (e) {
    console.warn(`[creator-opportunities] Exa ${lane} search failed:`, e instanceof Error ? e.message : e)
    return []
  }
}

/**
 * Platforms whose sponsorship coverage is overwhelmingly YouTube-shaped. The
 * index returns them for a TikTok query because there is simply far more
 * written about YouTube sponsorships, and a YouTube sponsor list is the wrong
 * answer for a creator whose entire corpus is TikTok.
 */
const NON_TIKTOK_SOURCES = [
  "youtube.com",
  "whosponsorsstuff.com",
  "patreon.com",
  "twitch.tv",
  // Product pages, not advertisers. A TikTok Shop listing for a webcam is a
  // thing being sold on the platform, not a brand buying creator media.
  "shop.tiktok.com",
]

/**
 * Brands already paying for this audience on TikTok specifically.
 *
 * Three angles, because no single one is reliable: TikTok's own disclosure
 * wording, which is the exact string a sponsored post carries; TikTok's ad and
 * Creative Center surfaces, where advertisers by industry are published; and
 * campaign write-ups in the trade press. YouTube-dominated sources are excluded
 * outright rather than hoped away in the prompt.
 */
export async function huntSponsors(
  topics: string[],
  markets: string[] = [],
): Promise<OpportunityCandidate[]> {
  const exa = getExa()
  if (!exa) return []
  const year = new Date().getFullYear()
  const out: OpportunityCandidate[] = []
  // Only the trade-press angle takes the market hint. The other two are pinned
  // to tiktok.com domains where a geography term just suppresses results.
  const where = markets.length ? ` ${markets.slice(0, 3).join(" OR ")}` : ""

  for (const topic of topics.slice(0, 3)) {
    // TikTok labels sponsored posts "Paid partnership with X" — searching the
    // platform itself finds who is actually running them, not who writes about it.
    out.push(
      ...(await exaSearch(exa, "sponsors", `"paid partnership" ${topic} TikTok`, 5, {
        includeDomains: ["tiktok.com"],
        excludeDomains: ["shop.tiktok.com"],
        withinDays: 180,
      })),
    )

    // TikTok's own business surfaces, where advertisers are named in case
    // studies. Restricted to their domain because an open query returns SEO
    // guides about the Creative Center rather than anyone advertising on it.
    out.push(
      ...(await exaSearch(
        exa,
        "sponsors",
        `${topic} brand case study advertising results`,
        4,
        { includeDomains: ["ads.tiktok.com", "newsroom.tiktok.com"], withinDays: 365 },
      )),
    )

    // Trade-press campaign write-ups, which name the brand and the agency.
    out.push(
      ...(await exaSearch(
        exa,
        "sponsors",
        `${topic} brand TikTok campaign OR "creator campaign" case study${where} ${year}`,
        4,
        { excludeDomains: NON_TIKTOK_SOURCES, withinDays: 180 },
      )),
    )
  }

  return out
}

/**
 * Speaking, panels, podcast guesting, creator events.
 *
 * Dated explicitly against the current and next year, and restricted to pages
 * published in the last 90 days. A conference listing that ranks well is often
 * a past edition, and proposing a closed call wastes the creator's time and
 * costs trust in everything else on the screen.
 */
export async function huntEvents(
  topics: string[],
  markets: string[] = [],
): Promise<OpportunityCandidate[]> {
  const exa = getExa()
  if (!exa) return []
  const now = new Date()
  const thisYear = now.getFullYear()
  const nextYear = thisYear + 1

  // Unscoped, a conference query returns whichever edition ranks best, which
  // correlates with nothing the creator cares about. A stage in the wrong market
  // is a flight and a week for an audience that will never buy.
  const where = markets.length ? ` in ${markets.slice(0, 4).join(" or ")}` : ""

  const out: OpportunityCandidate[] = []
  for (const topic of topics.slice(0, 3)) {
    out.push(
      ...(await exaSearch(
        exa,
        "events",
        `${topic} conference${where} ${thisYear} OR ${nextYear} "call for speakers" OR "call for proposals" OR "speaker applications open" OR "apply to speak"`,
        5,
        { withinDays: 90 },
      )),
    )
    out.push(
      ...(await exaSearch(
        exa,
        "events",
        `${topic} podcast${where} "guest" submission OR "pitch a guest" ${thisYear}`,
        3,
        { withinDays: 90 },
      )),
    )
  }

  // US tech conferences by name.
  //
  // The generic query above plus a market hint does not reach these: a ranker
  // asked for "AI conference in the United States" returns listicles of
  // conferences, not the call for speakers on the conference's own site. The
  // circuit is small enough to name, and naming it is the difference between
  // knowing a call is open and reading that one exists.
  const usCircuit = [
    "techcrunch.com",
    "websummit.com",
    "sxsw.com",
    "ces.tech",
    "money2020.com",
    "hbr.org",
    "aicpa-cima.com",
    "theaisummit.com",
    "reinvent.awsevents.com",
    "gtc.nvidia.com",
    "saastr.com",
  ]
  if (markets.some((m) => /united states|usa|us\b|america/i.test(m))) {
    out.push(
      ...(await exaSearch(
        exa,
        "events",
        `${thisYear} OR ${nextYear} "call for speakers" OR "speaker application" OR "call for proposals" OR "submit a session" apply`,
        8,
        { includeDomains: usCircuit, withinDays: 120 },
      )),
    )
  }

  return out
}

/**
 * US federal funding, from Grants.gov.
 *
 * Keyless, filters properly on status, and returns a real closing date, which
 * is the only field that decides whether a grant is an opportunity or a
 * history lesson.
 */
export async function huntGrantsUS(topics: string[]): Promise<OpportunityCandidate[]> {
  const out: OpportunityCandidate[] = []
  const now = Date.now()
  // Topics overlap by design, so the same call comes back under two of them.
  const seen = new Set<string>()

  for (const topic of topics.slice(0, 3)) {
    try {
      const res = await fetch("https://api.grants.gov/v1/api/search2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: topic,
          // forecasted as well as posted: a forecast is the earliest possible
          // sight of a call, months before it opens, which is the whole reason
          // this desk exists.
          oppStatuses: "forecasted|posted",
          rows: 12,
        }),
      })
      if (!res.ok) {
        console.warn(`[creator-opportunities] Grants.gov HTTP ${res.status}`)
        continue
      }
      const data = (await res.json()) as {
        data?: { oppHits?: Array<{ id?: string; number?: string; title?: string; agencyCode?: string; agency?: string; closeDate?: string; openDate?: string }> }
      }

      // Grants.gov matches loosely across the whole announcement, so an AI
      // query returns maternal health and child protection programmes that
      // mention a model somewhere in the body. Requiring a distinctive term
      // from the topic to appear in the TITLE is crude and works: a funder that
      // means to fund this says so in the name of the call.
      const terms = topicTerms(topic)

      for (const hit of data.data?.oppHits ?? []) {
        if (!hit.title || !hit.id) continue
        if (seen.has(hit.id)) continue
        // Grants.gov returns titles HTML-escaped, so "AI &amp; Digital Skills"
        // arrives literally and would be read out that way on a card.
        const clean = decodeEntities(hit.title)
        const title = clean.toLowerCase()
        if (terms.length && !terms.some((t) => title.includes(t))) continue
        seen.add(hit.id)
        // Grants.gov returns MM/DD/YYYY. An entry with no close date is usually
        // a standing announcement, which is still worth surfacing; one with a
        // date in the past is not.
        const close = parseUsDate(hit.closeDate)
        if (close && close.getTime() < now) continue
        out.push({
          lane: "grants",
          title: `${clean} (${hit.agency ?? hit.agencyCode ?? "US federal"})`,
          url: `https://www.grants.gov/search-results-detail/${hit.id}`,
          evidence: `US federal funding opportunity ${hit.number ?? ""} from ${hit.agency ?? hit.agencyCode ?? "a federal agency"}. ${
            close ? `Applications close ${close.toISOString().slice(0, 10)}.` : "No published closing date; treat as a standing announcement."
          } Matched on "${topic}".`,
          deadline: close ? close.toISOString().slice(0, 10) : null,
        })
      }
    } catch (e) {
      console.warn("[creator-opportunities] Grants.gov failed:", e instanceof Error ? e.message : e)
    }
  }

  return out
}

/**
 * The distinctive words in a topic, longest first.
 *
 * Stopwords and the genuinely generic terms are dropped: "intelligence" alone
 * matches an intelligence-community grant, and "evidence" alone matches every
 * evidence-based-practice programme in health and social care, which is exactly
 * how the noise arrived.
 */
const GENERIC_TOPIC_WORDS = new Set([
  "the", "and", "for", "with", "from", "into", "that", "this", "your",
  "artificial", "intelligence", "evidence", "professional", "services",
  "technology", "digital", "data", "systems", "research", "enterprise",
])

function topicTerms(topic: string): string[] {
  const words = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !GENERIC_TOPIC_WORDS.has(w))

  // "artificial intelligence" as a phrase is meaningful even though neither
  // word survives alone, so it is restored explicitly when both were present.
  const phrases: string[] = []
  const lower = topic.toLowerCase()
  for (const phrase of ["artificial intelligence", "machine learning", "generative ai"]) {
    if (lower.includes(phrase)) phrases.push(phrase)
  }
  if (/\bai\b/.test(lower)) phrases.push(" ai ", "ai ", " ai")

  return [...phrases, ...words].sort((a, b) => b.length - a.length)
}

/** The handful of entities Grants.gov actually emits. Not a general HTML decoder. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim()
}

function parseUsDate(value: string | undefined): Date | null {
  if (!value) return null
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const d = new Date(`${m[3]}-${m[1]}-${m[2]}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * European and Irish funding, via search rather than the official API.
 *
 * The EU Funding and Tenders portal does expose a keyless endpoint
 * (api.tech.ec.europa.eu, apiKey=SEDIA) and it is a trap. It returns HTTP 200
 * and parseable JSON, its `query` parameter is silently ignored, and it ranks
 * by an internal relevance that puts closed Horizon 2020 calls from 2018 above
 * anything live: a 100 row page for "artificial intelligence" yielded 15 FAQ
 * pages, 77 expired calls and 2 open ones, both the same call twice. Reachable
 * is not the same as useful, and that distinction has already cost this desk
 * one lane.
 *
 * So the domains are named and the ranking is Exa's, which is good, plus a
 * recency window that does most of the deadline filtering for free.
 */
const EU_FUNDING_DOMAINS = [
  "ec.europa.eu",
  "eismea.ec.europa.eu",
  "eic.ec.europa.eu",
  "cordis.europa.eu",
  "culture.ec.europa.eu",
  "digital-strategy.ec.europa.eu",
  // Ireland, where the creator is based and therefore eligible for national
  // as well as union schemes.
  "enterprise-ireland.com",
  "sfi.ie",
  "screenireland.ie",
  "researchireland.ie",
  "localenterprise.ie",
  // UK, a declared target market with its own funding bodies.
  "ukri.org",
  "innovateuk.ukri.org",
  "artscouncil.org.uk",
]

export async function huntGrantsEU(topics: string[]): Promise<OpportunityCandidate[]> {
  const exa = getExa()
  if (!exa) return []
  const year = new Date().getFullYear()
  const out: OpportunityCandidate[] = []

  for (const topic of topics.slice(0, 3)) {
    out.push(
      ...(await exaSearch(
        exa,
        "grants",
        `${topic} funding call OR grant OR "call for proposals" open deadline ${year} OR ${year + 1}`,
        6,
        { includeDomains: EU_FUNDING_DOMAINS, withinDays: 150 },
      )),
    )
  }

  // Media, journalism and creator funds are a different vocabulary from
  // research funding and would never surface on the query above, yet they are
  // the ones this creator is actually eligible for as an individual.
  out.push(
    ...(await exaSearch(
      exa,
      "grants",
      `journalism OR media OR creator fund grant fellowship application open ${year} Europe OR Ireland deadline`,
      6,
      { withinDays: 120 },
    )),
  )

  return out
}

/**
 * US technology media, and the programmes attached to them.
 *
 * Named domains rather than an open query, because "how to get covered by
 * TechCrunch" is a bottomless well of SEO content and none of it is an
 * opportunity. Restricting to the publishers and funds themselves means a hit
 * is a real call, a real submission window or a real programme.
 */
const US_MEDIA_DOMAINS = [
  "techcrunch.com",
  "a16z.com",
  "speedrun.a16z.com",
  "future.com",
  "theinformation.com",
  "axios.com",
  "wired.com",
  "fastcompany.com",
  "forbes.com",
  "inc.com",
  "fortune.com",
  "cfodive.com",
  "accountingtoday.com",
  "journalofaccountancy.com",
]

export async function huntUsMedia(topics: string[]): Promise<OpportunityCandidate[]> {
  const exa = getExa()
  if (!exa) return []
  const year = new Date().getFullYear()
  const out: OpportunityCandidate[] = []

  for (const topic of topics.slice(0, 2)) {
    // Contributor and op-ed routes: a byline in a title the target market reads
    // is the gap the strategy names, and these pages are where the door is.
    out.push(
      ...(await exaSearch(
        exa,
        "media",
        `${topic} contributor OR "write for us" OR "op-ed submission" OR "pitch us" guidelines`,
        5,
        { includeDomains: US_MEDIA_DOMAINS, withinDays: 365 },
      )),
    )
  }

  // Programmes and open calls run BY these organisations: accelerators, creator
  // funds, speaker calls, awards. a16z Speedrun and TechCrunch Disrupt's
  // Battlefield are both of this shape and neither is a media pitch.
  out.push(
    ...(await exaSearch(
      exa,
      "media",
      `applications open ${year} OR ${year + 1} founder OR creator OR speaker program apply deadline`,
      8,
      { includeDomains: US_MEDIA_DOMAINS, withinDays: 120 },
    )),
  )

  return out
}

/** Companies in the topic space via Apollo.io REST. No-op until APOLLO_API_KEY is set. */
export async function huntApolloCompanies(
  topics: string[],
  markets: string[] = [],
): Promise<OpportunityCandidate[]> {
  const key = process.env.APOLLO_API_KEY?.trim()
  if (!key) return []

  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_companies/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({
        q_organization_keyword_tags: topics.slice(0, 5),
        // Apollo filters on this natively, so the market constraint is a real
        // filter here rather than a hint the ranker may ignore.
        ...(markets.length ? { organization_locations: markets.slice(0, 5) } : {}),
        per_page: 15,
      }),
    })
    if (!res.ok) {
      console.warn(`[creator-opportunities] Apollo search HTTP ${res.status}`)
      return []
    }
    const data = (await res.json()) as {
      organizations?: Array<{ name?: string; website_url?: string; industry?: string; estimated_num_employees?: number }>
    }
    return (data.organizations ?? [])
      .filter((org) => org.name)
      .map((org) => ({
        lane: "apollo" as const,
        title: org.name!,
        url: org.website_url ?? null,
        evidence: `Industry: ${org.industry ?? "unknown"}; ~${org.estimated_num_employees ?? "?"} employees. Matched on topic keywords.`,
      }))
  } catch (e) {
    console.warn("[creator-opportunities] Apollo search failed:", e instanceof Error ? e.message : e)
    return []
  }
}

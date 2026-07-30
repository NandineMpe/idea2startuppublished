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
  lane: "sponsors" | "events" | "apollo"
  title: string
  url: string | null
  evidence: string
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
export async function huntSponsors(topics: string[]): Promise<OpportunityCandidate[]> {
  const exa = getExa()
  if (!exa) return []
  const year = new Date().getFullYear()
  const out: OpportunityCandidate[] = []

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
        `${topic} brand TikTok campaign OR "creator campaign" case study ${year}`,
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
export async function huntEvents(topics: string[]): Promise<OpportunityCandidate[]> {
  const exa = getExa()
  if (!exa) return []
  const now = new Date()
  const thisYear = now.getFullYear()
  const nextYear = thisYear + 1

  const out: OpportunityCandidate[] = []
  for (const topic of topics.slice(0, 3)) {
    out.push(
      ...(await exaSearch(
        exa,
        "events",
        `${topic} conference ${thisYear} OR ${nextYear} "call for speakers" OR "call for proposals" OR "speaker applications open" OR "apply to speak"`,
        5,
        { withinDays: 90 },
      )),
    )
    out.push(
      ...(await exaSearch(
        exa,
        "events",
        `${topic} podcast "guest" submission OR "pitch a guest" ${thisYear}`,
        3,
        { withinDays: 90 },
      )),
    )
  }
  return out
}

/** Companies in the topic space via Apollo.io REST. No-op until APOLLO_API_KEY is set. */
export async function huntApolloCompanies(topics: string[]): Promise<OpportunityCandidate[]> {
  const key = process.env.APOLLO_API_KEY?.trim()
  if (!key) return []

  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_companies/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({
        q_organization_keyword_tags: topics.slice(0, 5),
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

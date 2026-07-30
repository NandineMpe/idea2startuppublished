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

async function exaSearch(
  exa: Exa,
  lane: OpportunityCandidate["lane"],
  query: string,
  numResults: number,
  /** Only pages published within this window. Without it the index happily
   *  returns a conference that closed last year, which is worse than nothing. */
  withinDays = 120,
): Promise<OpportunityCandidate[]> {
  try {
    const res = await exa.searchAndContents(query, {
      numResults,
      text: { maxCharacters: 1500 },
      type: "auto",
      startPublishedDate: daysAgo(withinDays),
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

/** Brands already sponsoring creators in this topic space. */
export async function huntSponsors(topics: string[]): Promise<OpportunityCandidate[]> {
  const exa = getExa()
  if (!exa) return []
  const out: OpportunityCandidate[] = []
  for (const topic of topics.slice(0, 3)) {
    out.push(
      ...(await exaSearch(
        exa,
        "sponsors",
        `brands sponsoring ${topic} TikTok creators "paid partnership" OR "#ad" OR "sponsored by"`,
        6,
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
        90,
      )),
    )
    out.push(
      ...(await exaSearch(
        exa,
        "events",
        `${topic} podcast "guest" submission OR "pitch a guest" ${thisYear}`,
        3,
        90,
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

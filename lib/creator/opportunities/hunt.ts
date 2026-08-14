import {
  fetchConferenceCalls,
  fetchEuCalls,
  fetchFunderFeeds,
  fetchSponsorSignals,
  fetchUsMediaCoverage,
} from "./sources"

/**
 * The Opportunities agent's hunting lanes.
 *
 * Every lane is keyless. This was a rewrite, not a preference: the desk used to
 * run every lane through a paid search index, and when the credit ran out
 * nothing failed. Searches returned empty arrays, the sweep proposed nothing,
 * and the screen looked like a quiet week. A dependency that degrades to
 * silence is worse than one that degrades to an error, because nobody
 * investigates a quiet week.
 *
 * Reading the registers directly is also simply better for this job. A funder
 * publishes its calls with the deadline as a field; a conference publishes its
 * call for speakers with a closing date. Neither needs a ranker's opinion, and
 * neither can quietly stop working without returning a 404.
 *
 * Lanes:
 *  - grants:   EU Funding and Tenders register, UKRI, US Grants.gov
 *  - events:   conference calls for speakers with live CFP deadlines
 *  - media:    what US titles are commissioning on right now
 *  - sponsors: campaigns named in the marketing trade press
 *  - apollo:   companies in the topic space — gated on APOLLO_API_KEY, skipped silently when absent
 */

export type OpportunityCandidate = {
  lane: "sponsors" | "events" | "apollo" | "grants" | "media"
  title: string
  url: string | null
  evidence: string
  /** Set by lanes that carry a real closing date. A grant is only an opportunity until then. */
  deadline?: string | null
  /**
   * Where the application is actually made or started.
   *
   * Always taken from the register, never constructed and never chosen by the
   * model. A guessed apply link is the same class of failure as a guessed
   * contact: it looks right, it is clickable, and it sends the creator to a
   * 404 on the morning of a deadline.
   */
  apply_url?: string | null
  /** Who may apply, quoted from the announcement. The first thing that decides a grant. */
  eligibility?: string | null
  /** Published contact for the call. Free, and better than an inferred one. */
  contact_email?: string | null
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
 * The fields the Grants.gov search endpoint leaves out.
 *
 * Eligibility is the important one. Most US federal calls restrict applicants
 * to organisations located in the United States, and the search endpoint says
 * nothing about it, so the desk was surfacing a dozen calls a day that an
 * Ireland-based individual is simply barred from. Reading the real text means
 * the model can rule them out on evidence rather than on a guess, and means the
 * few that genuinely are open show up as such.
 */
async function fetchGrantDetail(opportunityId: string): Promise<{
  eligibility: string | null
  applyUrl: string | null
  contactEmail: string | null
}> {
  const empty = { eligibility: null, applyUrl: null, contactEmail: null }
  try {
    const res = await fetch("https://api.grants.gov/v1/api/fetchOpportunity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId: Number(opportunityId) }),
    })
    if (!res.ok) return empty
    const data = (await res.json()) as {
      data?: {
        synopsis?: {
          applicantEligibilityDesc?: string
          fundingDescLinkUrl?: string
          agencyContactEmail?: string
        }
      }
    }
    const syn = data.data?.synopsis
    if (!syn) return empty

    // The eligibility text is HTML with escaped entities inside it, so it needs
    // both stripped before it can be read aloud or reasoned over.
    const eligibility = syn.applicantEligibilityDesc
      ? decodeEntities(decodeEntities(syn.applicantEligibilityDesc).replace(/<[^>]+>/g, " "))
          .replace(/\s+/g, " ")
          .slice(0, 700)
      : null

    const link = syn.fundingDescLinkUrl?.trim()
    return {
      eligibility,
      applyUrl: link && /^https?:\/\//i.test(link) ? link : null,
      contactEmail: syn.agencyContactEmail?.trim() || null,
    }
  } catch {
    return empty
  }
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

        // Second call per surviving hit, for the three fields the search
        // endpoint does not return and that decide everything: who may apply,
        // where the agency's own announcement lives, and who to write to. All
        // keyless. Twelve extra requests a day is a cheap price for not
        // proposing grants the creator is barred from.
        const detail = await fetchGrantDetail(hit.id)

        out.push({
          lane: "grants",
          title: `${clean} (${hit.agency ?? hit.agencyCode ?? "US federal"})`,
          url: `https://www.grants.gov/search-results-detail/${hit.id}`,
          evidence: `US federal funding opportunity ${hit.number ?? ""} from ${hit.agency ?? hit.agencyCode ?? "a federal agency"}. ${
            close ? `Applications close ${close.toISOString().slice(0, 10)}.` : "No published closing date; treat as a standing announcement."
          } Matched on "${topic}".${detail.eligibility ? ` WHO MAY APPLY: ${detail.eligibility}` : ""}`,
          deadline: close ? close.toISOString().slice(0, 10) : null,
          // The agency's own announcement is the better landing page when it
          // exists: it carries the full instructions and the submission route.
          // The Grants.gov detail page is the fallback and carries the Apply
          // button either way.
          apply_url: detail.applyUrl ?? `https://www.grants.gov/search-results-detail/${hit.id}`,
          eligibility: detail.eligibility,
          contact_email: detail.contactEmail,
        })
      }
    } catch (e) {
      console.warn("[creator-opportunities] Grants.gov failed:", e instanceof Error ? e.message : e)
    }
  }

  return out
}

/** European, Irish and UK funding, straight from the registers that publish it. */
export async function huntGrantsEU(topics: string[]): Promise<OpportunityCandidate[]> {
  const [eu, funders] = await Promise.all([fetchEuCalls(topics), fetchFunderFeeds(topics)])
  return [...eu, ...funders]
}

/** Conference calls for speakers whose CFP has not closed yet. */
export async function huntEvents(
  _topics: string[],
  markets: string[] = [],
): Promise<OpportunityCandidate[]> {
  return fetchConferenceCalls(markets)
}

/** What US titles the target market reads are commissioning on right now. */
export async function huntUsMedia(topics: string[]): Promise<OpportunityCandidate[]> {
  return fetchUsMediaCoverage(topics)
}

/** Campaigns named in the marketing trade press. */
export async function huntSponsors(
  topics: string[],
  _markets: string[] = [],
): Promise<OpportunityCandidate[]> {
  return fetchSponsorSignals(topics)
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

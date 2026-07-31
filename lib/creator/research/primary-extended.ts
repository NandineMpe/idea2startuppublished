import Exa from "exa-js"
import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"
import { filterByDomainTerms } from "./primary"

/**
 * The second tier of primary sources.
 *
 * Where the first module covers what was filed, granted, funded and litigated,
 * these cover the places a profession's direction becomes visible before the
 * profession has agreed on it: who is being hired, what the supervisors are
 * writing, which consultations are open, what the regulator found on inspection,
 * and which papers were withdrawn.
 *
 * Most of these bodies publish no API at all, so the majority route through a
 * single domain-scoped search helper. That is a deliberate trade: an allowlist
 * of authoritative domains gets primary documents out of a general index, which
 * is worth far more than the handful of real APIs that exist here.
 */

const UA = "Juno Creator OS Research (contact: nandini@augentik.com)"

export type ExtendedLane =
  | "jobs"
  | "scholarship"
  | "inspections"
  | "consultations"
  | "supervisors"
  | "procurement"
  | "conferences"
  | "retractions"
  | "syscards"

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
}

function getExa(): Exa {
  const key = process.env.EXA_API?.trim() || process.env.EXA_API_KEY?.trim()
  if (!key) throw new Error("EXA_API not set")
  return new Exa(key)
}

/**
 * The shared shape for every source that publishes documents on its own site
 * and nothing else. The domain allowlist is the whole mechanism: it is what
 * separates a regulator's own inspection report from a law firm's blog post
 * about that report, which is exactly the distinction this desk exists to make.
 */
async function domainScoped(
  lane: ExtendedLane,
  sourceKey: string,
  query: string,
  domains: string[],
  days: number,
  numResults = 6,
): Promise<RawFeedItem[]> {
  const res = await getExa().searchAndContents(query, {
    numResults,
    type: "auto",
    includeDomains: domains,
    startPublishedDate: daysAgoISO(days),
    text: { maxCharacters: 1000 },
  })

  return (res.results ?? [])
    .filter((r) => r.url && r.title)
    .map((r) => ({
      source_key: sourceKey,
      source_item_id: r.url!,
      title: r.title!.trim(),
      body: typeof r.text === "string" ? r.text.replace(/\s+/g, " ").trim().slice(0, 1100) : "",
      url: r.url!,
      published_at: r.publishedDate ? new Date(r.publishedDate) : new Date(),
      authors: [],
      raw_payload: { lane },
    }))
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Jobs — the earliest institutional signal there is. A firm creating a "Head of
// AI Assurance" role has already decided, budgeted and got sign-off, months
// before it says anything publicly. Job specs also list the actual tools and
// frameworks, which press releases never do.
// ---------------------------------------------------------------------------

const JOB_BOARDS = [
  "boards.greenhouse.io",
  "jobs.lever.co",
  "job-boards.greenhouse.io",
  "apply.workable.com",
  "jobs.ashbyhq.com",
  "careers.pwc.com",
  "jobs.ey.com",
  "careers.kpmg.com",
  "jobs.deloitte.com",
]

export async function fetchJobs(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  return domainScoped(
    "jobs",
    "jobs:boards",
    `${topic} hiring role responsibilities`,
    JOB_BOARDS,
    Math.max(hoursBack / 24, 120),
  )
}

// ---------------------------------------------------------------------------
// Scholarship — OpenAlex, which indexes the journals and repositories arXiv
// does not: accounting, auditing, law, finance and management. The creator's
// own field publishes almost nowhere arXiv reaches, so without this the papers
// lane can only ever see the computer science half of their subject.
// ---------------------------------------------------------------------------

type OpenAlexWork = {
  id?: string
  doi?: string
  title?: string
  display_name?: string
  publication_date?: string
  cited_by_count?: number
  abstract_inverted_index?: Record<string, number[]>
  primary_location?: { source?: { display_name?: string } | null; landing_page_url?: string | null }
  authorships?: Array<{ author?: { display_name?: string } }>
}

/** OpenAlex stores abstracts as a position index. Reassembling is the only way to read one. */
function invertedToText(index: Record<string, number[]> | undefined): string {
  if (!index) return ""
  const slots: string[] = []
  for (const [word, positions] of Object.entries(index)) {
    for (const p of positions) slots[p] = word
  }
  return slots.filter(Boolean).join(" ").slice(0, 900)
}

export async function fetchScholarship(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const from = daysAgoISO(Math.max(hoursBack / 24, 180))
  // Capped at today: OpenAlex carries publisher metadata verbatim, and a
  // straight sort by date descending leads with records dated 2050 and 2031.
  const to = new Date().toISOString().slice(0, 10)
  const params = new URLSearchParams({
    search: topic,
    filter: `from_publication_date:${from},to_publication_date:${to}`,
    sort: "publication_date:desc",
    "per-page": "10",
    mailto: "nandini@augentik.com",
  })

  const data = await getJson<{ results?: OpenAlexWork[] }>(
    `https://api.openalex.org/works?${params}`,
  )

  const items: RawFeedItem[] = (data?.results ?? [])
    .filter((w) => (w.title || w.display_name) && w.id)
    .map((w) => ({
      source_key: "scholarship:openalex",
      source_item_id: w.id!,
      title: (w.title || w.display_name)!,
      body: [
        w.primary_location?.source?.display_name ? `In ${w.primary_location.source.display_name}.` : "",
        w.cited_by_count ? `Cited ${w.cited_by_count} times.` : "",
        invertedToText(w.abstract_inverted_index),
      ]
        .filter(Boolean)
        .join(" "),
      url: w.doi ? `https://doi.org/${w.doi.replace(/^https?:\/\/doi\.org\//, "")}` : w.id!,
      published_at: w.publication_date ? new Date(w.publication_date) : new Date(),
      authors: (w.authorships ?? []).map((a) => a.author?.display_name ?? "").filter(Boolean).slice(0, 4),
      raw_payload: { cited_by: w.cited_by_count ?? 0 },
    }))

  // OpenAlex indexes everything ever published, so its relevance search on a
  // short query drifts fast: a probe for AI auditing returned clinical external
  // quality assessment and Australian higher education policy.
  return filterByDomainTerms(items, topic).slice(0, 8)
}

// ---------------------------------------------------------------------------
// Inspections — what the regulator actually found when it looked. These are
// findings documents rather than positions, and they name deficiencies. Almost
// nobody outside the firms reads them.
// ---------------------------------------------------------------------------

const INSPECTION_DOMAINS = [
  "pcaobus.org",
  "frc.org.uk",
  "iaasa.ie",
  "sec.gov",
  "ftc.gov",
  "ico.org.uk",
  "esma.europa.eu",
]

export async function fetchInspections(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  return domainScoped(
    "inspections",
    "inspections:regulators",
    `${topic} inspection report OR enforcement OR findings OR deficiency`,
    INSPECTION_DOMAINS,
    Math.max(hoursBack / 24, 270),
  )
}

// ---------------------------------------------------------------------------
// Consultations — an open consultation is a door with a deadline. It is also
// the cheapest way on earth to become a named participant rather than a
// commentator, because responses are published under the respondent's name.
// ---------------------------------------------------------------------------

type GovUkResult = {
  title?: string
  link?: string
  public_timestamp?: string
  description?: string
}

async function fetchUkConsultations(topic: string): Promise<RawFeedItem[]> {
  const params = new URLSearchParams({
    q: topic,
    // The format filter that the docs suggest returns nothing; this is the
    // field that actually carries consultations.
    filter_content_store_document_type: "open_consultation",
    count: "6",
    fields: "title,link,public_timestamp,description",
  })
  const data = await getJson<{ results?: GovUkResult[] }>(
    `https://www.gov.uk/api/search.json?${params}`,
  )
  const items: RawFeedItem[] = (data?.results ?? [])
    .filter((r) => r.title && r.link)
    .map((r) => ({
      source_key: "consultations:gov-uk",
      source_item_id: `govuk:${r.link}`,
      title: `UK consultation (open): ${r.title}`,
      body: r.description ?? "",
      url: `https://www.gov.uk${r.link}`,
      published_at: r.public_timestamp ? new Date(r.public_timestamp) : new Date(),
      authors: ["gov.uk"],
      raw_payload: { open: true },
    }))

  // gov.uk ranks loosely across all of government: a query about AI in audit
  // returned a consultation on home upgrade schemes and one on a seismic array.
  return filterByDomainTerms(items, topic)
}

const EU_CONSULTATION_DOMAINS = [
  "ec.europa.eu",
  "digital-strategy.ec.europa.eu",
  "eba.europa.eu",
  "efrag.org",
  "ifrs.org",
  "iaasb.org",
  "ethicsboard.org",
]

export async function fetchConsultations(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const [uk, eu] = await Promise.all([
    fetchUkConsultations(topic).catch(() => [] as RawFeedItem[]),
    domainScoped(
      "consultations",
      "consultations:eu",
      `${topic} consultation OR "call for evidence" OR "exposure draft" comment`,
      EU_CONSULTATION_DOMAINS,
      Math.max(hoursBack / 24, 180),
      5,
    ).catch(() => [] as RawFeedItem[]),
  ])
  return [...uk, ...eu]
}

// ---------------------------------------------------------------------------
// Supervisors — central banks and financial stability bodies. They publish
// early, they publish carefully, and their language is the language the
// creator's target audience already trusts.
// ---------------------------------------------------------------------------

const SUPERVISOR_DOMAINS = [
  "bis.org",
  "fsb.org",
  "ecb.europa.eu",
  "bankofengland.co.uk",
  "imf.org",
  "federalreserve.gov",
  "centralbank.ie",
]

export async function fetchSupervisors(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  return domainScoped(
    "supervisors",
    "supervisors:central-banks",
    `${topic} report OR working paper OR financial stability`,
    SUPERVISOR_DOMAINS,
    Math.max(hoursBack / 24, 270),
  )
}

// ---------------------------------------------------------------------------
// Procurement — who is actually buying, with the specification attached and
// frequently the price. A tender is a commitment, unlike a press release.
// ---------------------------------------------------------------------------

const PROCUREMENT_DOMAINS = ["ted.europa.eu", "sam.gov", "find-tender.service.gov.uk", "contractsfinder.service.gov.uk"]

export async function fetchProcurement(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  return domainScoped(
    "procurement",
    "procurement:tenders",
    `${topic} tender OR contract notice OR solicitation`,
    PROCUREMENT_DOMAINS,
    Math.max(hoursBack / 24, 180),
    5,
  )
}

// ---------------------------------------------------------------------------
// Conferences — accepted papers and calls. FAccT in particular is the
// accountability research the trade press will be quoting in about a year.
// ---------------------------------------------------------------------------

const CONFERENCE_DOMAINS = [
  "facctconference.org",
  "neurips.cc",
  "icml.cc",
  "aies-conference.com",
  "openreview.net",
  "aaai.org",
]

export async function fetchConferences(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  return domainScoped(
    "conferences",
    "conferences:proceedings",
    `${topic} accepted paper OR proceedings OR "call for papers"`,
    CONFERENCE_DOMAINS,
    Math.max(hoursBack / 24, 270),
  )
}

// ---------------------------------------------------------------------------
// Retractions — Crossref carries the retraction notice itself. Directly the
// creator's existing beat, and a primary record rather than a report of one.
// ---------------------------------------------------------------------------

type CrossrefItem = {
  DOI?: string
  title?: string[]
  abstract?: string
  created?: { "date-time"?: string }
  "container-title"?: string[]
}

export async function fetchRetractions(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const params = new URLSearchParams({
    filter: `update-type:retraction,from-created-date:${daysAgoISO(Math.max(hoursBack / 24, 365))}`,
    "query.bibliographic": topic,
    rows: "8",
    select: "title,DOI,created,abstract,container-title",
    mailto: "nandini@augentik.com",
  })
  const data = await getJson<{ message?: { items?: CrossrefItem[] } }>(
    `https://api.crossref.org/works?${params}`,
  )

  const items: RawFeedItem[] = (data?.message?.items ?? [])
    .filter((i) => i.DOI && i.title?.length)
    // Crossref titles carry JATS markup, so a title arrives as "<scp>RETRACTION</scp>".
    .map((i) => ({ ...i, title: [i.title![0].replace(/<[^>]+>/g, "").trim()] }))
    .filter((i) => i.title[0].length > 3)
    .map((i) => ({
      source_key: "retractions:crossref",
      source_item_id: `doi:${i.DOI}`,
      title: `Retracted: ${i.title![0]}`,
      body: [
        i["container-title"]?.length ? `In ${i["container-title"][0]}.` : "",
        (i.abstract ?? "").replace(/<[^>]+>/g, "").slice(0, 700),
      ]
        .filter(Boolean)
        .join(" "),
      url: `https://doi.org/${i.DOI}`,
      published_at: i.created?.["date-time"] ? new Date(i.created["date-time"]) : new Date(),
      authors: [],
      raw_payload: { doi: i.DOI },
    }))

  // query.bibliographic ranks rather than filters, so without this the lane
  // returns whatever was retracted most recently regardless of subject.
  return filterByDomainTerms(items, topic).slice(0, 6)
}

// ---------------------------------------------------------------------------
// System cards — the technical appendix a lab publishes alongside a model. It
// is where the evaluations, the refusals and the known failure modes live, and
// it is a different genre from the announcement everyone reads instead.
// ---------------------------------------------------------------------------

const LAB_DOMAINS = [
  "openai.com",
  "anthropic.com",
  "deepmind.google",
  "ai.meta.com",
  "mistral.ai",
  "cdn.openai.com",
  "assets.anthropic.com",
  "storage.googleapis.com",
]

export async function fetchSystemCards(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  return domainScoped(
    "syscards",
    "syscards:labs",
    `${topic} system card OR model card OR evaluations OR safety report`,
    LAB_DOMAINS,
    Math.max(hoursBack / 24, 180),
  )
}

export const EXTENDED_ADAPTERS: Record<
  ExtendedLane,
  (topic: string, hoursBack: number) => Promise<RawFeedItem[]>
> = {
  jobs: fetchJobs,
  scholarship: fetchScholarship,
  inspections: fetchInspections,
  consultations: fetchConsultations,
  supervisors: fetchSupervisors,
  procurement: fetchProcurement,
  conferences: fetchConferences,
  retractions: fetchRetractions,
  syscards: fetchSystemCards,
}

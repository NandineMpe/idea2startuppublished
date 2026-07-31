import Exa from "exa-js"
import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"
import { meaningfulTokens } from "./lanes"

/**
 * Primary sources.
 *
 * The original lane set was mostly secondary. News, books and discussion are all
 * people writing about something that already happened, and a desk reading only
 * those can at best be fast. It cannot be first, and it can never say "here is
 * the document" because it never holds one.
 *
 * These lanes hold documents instead of coverage: what was filed, granted,
 * funded, litigated, proposed, published or shipped. Every one of them is
 * upstream of the headline, and several are upstream by years.
 *
 * The lag column is the point of the whole module:
 *
 *   jobs        a firm hiring for a capability, before it announces the capability
 *   code        what engineers adopt, months before vendors describe it
 *   models      capability trajectory, measurable rather than asserted
 *   funding     research funded now becomes papers in ~2y and products in ~4y
 *   patents     R&D intent, published 18 months after filing, still ahead of launch
 *   courts      complaints and expert reports, 1-3 years before the landmark ruling
 *   regulation  proposed rules and comment dockets, 6-18 months before binding
 *   filings     what companies tell investors under legal liability, ahead of PR
 *   standards   what "compliant" will mean, before anyone has to comply
 *
 * Every adapter is keyless except patents, which routes through Exa because the
 * patent offices either require OAuth (EPO) or have retired their open tier
 * (PatentsView).
 */

const UA = "Juno Creator OS Research (contact: nandini@augentik.com)"

export type PrimaryLane =
  | "patents"
  | "filings"
  | "courts"
  | "funding"
  | "regulation"
  | "standards"
  | "code"
  | "models"

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
}

/**
 * These indexes want key terms, not sentences.
 *
 * A trajectory query reads "PCAOB inspection findings artificial intelligence
 * audit technology 2026", which is a good instruction to a news ranker and a
 * guaranteed zero against EDGAR, GitHub or Hugging Face, where the terms are
 * ANDed against a title or a filing body. Every adapter that returned nothing on
 * the first probe returned nothing for exactly this reason.
 *
 * Bare years are dropped: a filing from December does not contain next year.
 */
function keyTerms(topic: string, max: number): string[] {
  return meaningfulTokens(topic)
    .filter((t) => !/^\d{4}$/.test(t))
    .filter((t) => t.length >= 3 || t === "ai")
    .slice(0, max)
}

/**
 * Multi-word names have to survive tokenisation or the query means something
 * else. "artificial intelligence" split into two ANDed words still works;
 * "machine learning" does not, because "machine" drags in manufacturing.
 */
const PHRASES = [
  "artificial intelligence",
  "machine learning",
  "large language model",
  "internal audit",
  "audit evidence",
  "financial reporting",
  "risk management",
  "generative ai",
]

function detectPhrases(topic: string): string[] {
  const lower = topic.toLowerCase()
  return PHRASES.filter((p) => lower.includes(p))
}

/**
 * Vocabulary that is true of every signal this desk will ever retrieve, and
 * therefore carries no information about whether a result is on topic.
 */
const GENERIC = new Set([
  "artificial", "intelligence", "ai", "machine", "learning", "model", "models",
  "data", "system", "systems", "technology", "digital", "generative", "llm",
  "algorithm", "algorithmic", "automated", "automation", "neural", "deep",
  // Ordinary English that happens to appear in a domain phrase. "internal" is
  // load-bearing in "internal audit" and meaningless on its own, and on its own
  // is exactly how it turns up in a grant abstract about microbiology.
  "internal", "external", "national", "public", "general", "program", "programs",
  "use", "using", "management", "practice", "practices",
])

/**
 * The terms worth searching on, most distinctive first.
 *
 * Acronyms lead, and they lead by a distance. A trajectory query carries names
 * like PCAOB, FRC, IAASB, SEC or ISQM, and those are the exact strings that
 * appear in a docket, a proposed rule or a grant abstract. Everything else is
 * ordered longest-first as a cheap proxy for specificity.
 *
 * This matters most in the sources that index the technology rather than the
 * profession. A court docket about AI will not contain the word "assurance",
 * but a rulemaking involving the audit regulator will contain "PCAOB", so
 * searching the professional vocabulary there returns nothing while searching
 * the proper noun returns the document.
 */
function acronyms(topic: string): string[] {
  return [...new Set(topic.match(/\b[A-Z]{2,6}\b/g) ?? [])]
    .map((a) => a.toLowerCase())
    .filter((a) => a !== "ai" && a !== "the")
}

function domainTerms(topic: string): string[] {
  const acr = acronyms(topic)
  const rest = meaningfulTokens(topic)
    .filter((t) => !GENERIC.has(t) && !/^\d{4}$/.test(t))
    .filter((t) => !acr.includes(t))
    .sort((a, b) => b.length - a.length)
  return [...acr, ...rest]
}

/**
 * Require a match on something that is not generic AI vocabulary.
 *
 * The shared relevance filter asks for two matching terms, and "artificial" plus
 * "intelligence" satisfies that on its own, which is how a query about AI in
 * audit came back with atmospheric emulators and mixed-precision training. The
 * domain words are the ones that decide whether a result is about this
 * creator's subject, so at least one of them has to appear.
 */
function filterByDomainTerms(items: RawFeedItem[], topic: string, required = 1): RawFeedItem[] {
  const domain = domainTerms(topic)
  if (!domain.length) return items

  return items.filter((item) => {
    const haystack = meaningfulTokens(`${item.title} ${item.body ?? ""}`)
    const hits = domain.filter((w) =>
      haystack.some((h) => h === w || (w.length >= 5 && h.startsWith(w.slice(0, 5)))),
    ).length
    return hits >= required
  })
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Patents — what was filed, which is R&D intent rather than marketing.
// ---------------------------------------------------------------------------

export async function fetchPatents(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const key = process.env.EXA_API?.trim() || process.env.EXA_API_KEY?.trim()
  if (!key) throw new Error("EXA_API not set")
  const exa = new Exa(key)

  // A patent is published 18 months after filing, so a tight window returns
  // nothing. Two years of publications is the useful horizon here.
  const res = await exa.searchAndContents(`${topic} patent`, {
    numResults: 8,
    type: "auto",
    includeDomains: ["patents.google.com"],
    startPublishedDate: daysAgoISO(Math.max(hoursBack / 24, 730)),
    text: { maxCharacters: 900 },
  })

  return (res.results ?? [])
    .filter((r) => r.url && r.title)
    .map((r) => ({
      source_key: "patents:google",
      source_item_id: r.url!,
      title: r.title!.trim(),
      body: typeof r.text === "string" ? r.text.trim().slice(0, 1200) : "",
      url: r.url!,
      published_at: r.publishedDate ? new Date(r.publishedDate) : new Date(),
      authors: [],
      raw_payload: { lane: "patents" },
    }))
}

// ---------------------------------------------------------------------------
// Filings — EDGAR full text. What a company tells investors is written under
// legal liability, which makes it a very different document from its blog.
// ---------------------------------------------------------------------------

type EdgarHit = {
  _id: string
  _source: {
    ciks?: string[]
    display_names?: string[]
    file_date?: string
    file_type?: string
    root_form?: string
  }
}

function edgarUrl(id: string, cik: string | undefined): string | null {
  // "0001683168-20-000837:radnet_8k-ex9901.htm" -> archive path
  const [accession, filename] = id.split(":")
  if (!accession || !filename || !cik) return null
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, "")}/${filename}`
}

async function edgarSearch(
  topic: string,
  forms: string,
  sourceKey: string,
  days: number,
  limit: number,
): Promise<RawFeedItem[]> {
  // Quoted phrases ANDed together. The whole topic as one quoted phrase matches
  // no filing ever written; two short phrases narrows ten thousand hits to a
  // usable thousand and keeps them on subject.
  const phrases = detectPhrases(topic)
  const rest = keyTerms(topic, 6).filter((t) => !phrases.some((p) => p.includes(t)))
  const query = [...phrases.map((p) => `"${p}"`), ...rest.slice(0, 2)].join(" ") || topic

  const params = new URLSearchParams({
    q: query,
    forms,
    startdt: daysAgoISO(days),
    enddt: new Date().toISOString().slice(0, 10),
  })
  const data = await getJson<{ hits?: { hits?: EdgarHit[] } }>(
    `https://efts.sec.gov/LATEST/search-index?${params}`,
  )

  return (data?.hits?.hits ?? []).slice(0, limit).map((hit) => {
    const company = hit._source.display_names?.[0] ?? "Unknown filer"
    const form = hit._source.root_form ?? hit._source.file_type ?? "filing"
    const url = edgarUrl(hit._id, hit._source.ciks?.[0])
    return {
      source_key: sourceKey,
      source_item_id: hit._id,
      title: `${company} — ${form}`,
      body: `${company} filed a ${form} on ${hit._source.file_date ?? "unknown date"} whose text matches "${topic}". SEC filings are made under liability, so the language is what the company is prepared to defend.`,
      url: url ?? "https://www.sec.gov/cgi-bin/browse-edgar",
      published_at: hit._source.file_date ? new Date(hit._source.file_date) : new Date(),
      authors: [company],
      raw_payload: { form, cik: hit._source.ciks?.[0] ?? null },
    }
  })
}

export async function fetchFilings(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  // Annual and current reports: risk factors and material events.
  return edgarSearch(topic, "10-K,20-F,8-K,6-K", "filings:edgar", Math.max(hoursBack / 24, 120), 8)
}

// ---------------------------------------------------------------------------
// Funding — Form D is the filing a company makes when it raises privately, so
// it is the document the funding announcement is written from. Paired with
// public research grants, which fund the papers nobody has written yet.
// ---------------------------------------------------------------------------

type NsfAward = {
  id?: string
  title?: string
  date?: string
  awardeeName?: string
  fundsObligatedAmt?: string
  abstractText?: string
}

export async function fetchFunding(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const days = Math.max(hoursBack / 24, 180)

  const [formD, grants] = await Promise.all([
    // Form D is filed on a raise. Its text is thin, so it is best effort here
    // rather than something the lane depends on.
    edgarSearch(topic, "D", "funding:form-d", days, 4).catch(() => [] as RawFeedItem[]),
    (async () => {
      const params = new URLSearchParams({
        // Domain words lead: NSF's matcher weights whatever it is given, and
        // leading with "artificial intelligence" returns the whole of the AI
        // portfolio regardless of what the rest of the query said.
        keyword: [...domainTerms(topic).slice(0, 2), ...keyTerms(topic, 2)].slice(0, 4).join("+"),
        printFields: "id,title,date,awardeeName,fundsObligatedAmt,abstractText",
        rpp: "20",
      })
      const data = await getJson<{ response?: { award?: NsfAward[] } }>(
        `https://api.nsf.gov/services/v1/awards.json?${params}`,
      )
      // NSF's keyword match is extremely loose: a probe for AI audit evidence
      // came back with squid hydrodynamics and a microbiology summer school.
      return (data?.response?.award ?? [])
        .filter((a) => a.title && a.id)
        .map((a) => ({
          source_key: "funding:nsf",
          source_item_id: `nsf:${a.id}`,
          title: `NSF award: ${a.title}`,
          body: [
            a.awardeeName ? `Awarded to ${a.awardeeName}.` : "",
            a.fundsObligatedAmt ? `Obligated: $${Number(a.fundsObligatedAmt).toLocaleString()}.` : "",
            (a.abstractText ?? "").slice(0, 700),
          ]
            .filter(Boolean)
            .join(" "),
          url: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${a.id}`,
          published_at: a.date ? new Date(a.date) : new Date(),
          authors: a.awardeeName ? [a.awardeeName] : [],
          raw_payload: { funder: "NSF", amount: a.fundsObligatedAmt ?? null },
        }))
    })().catch(() => [] as RawFeedItem[]),
  ])

  // Two matches for grants, unlike every other lane. NSF's keyword matcher is
  // extremely loose and its abstracts run to hundreds of words, which is the
  // exact combination that lets a single stem collide: a query about conformity
  // assessment matched "Assessing Wild Bee Resilience to Heat Waves". Long text
  // is also what makes a second match a fair thing to ask for.
  return [...formD, ...filterByDomainTerms(grants, topic, 2)].slice(0, 8)
}

// ---------------------------------------------------------------------------
// Courts — complaints, dockets and opinions. The expert reports filed in an AI
// case are frequently the most detailed public technical documents in existence
// on how a system actually works, and they appear years before any ruling.
// ---------------------------------------------------------------------------

type CourtListenerResult = {
  absolute_url?: string
  caseName?: string
  court?: string
  dateFiled?: string
  docketNumber?: string
  suitNature?: string
  /** The matched text lives here, one level down, and only when highlight is on. */
  opinions?: Array<{ snippet?: string }>
}

export async function fetchCourts(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const days = Math.max(hoursBack / 24, 365)
  // Deliberately loose: there are not many AI opinions, and stacking phrases
  // took a search that returned twenty cases down to zero. One anchor phrase
  // plus one domain word, then filter hard on the way out.
  const phrase = detectPhrases(topic)[0] ?? "artificial intelligence"
  const params = new URLSearchParams({
    q: [`"${phrase}"`, domainTerms(topic)[0]].filter(Boolean).join(" "),
    type: "o",
    // Without this every result comes back with an empty snippet, and the only
    // text available to judge relevance is the case name. Case names never
    // contain the subject matter, so the lane filtered itself down to nothing
    // on every query while the API was returning twenty real hits.
    highlight: "on",
    order_by: "dateFiled desc",
    filed_after: daysAgoISO(days),
  })
  const data = await getJson<{ results?: CourtListenerResult[] }>(
    `https://www.courtlistener.com/api/rest/v4/search/?${params}`,
  )

  const items: RawFeedItem[] = (data?.results ?? [])
    .filter((r) => r.absolute_url && r.caseName)
    .map((r) => ({
      source_key: "courts:courtlistener",
      source_item_id: r.absolute_url!,
      title: r.caseName!,
      body: [
        r.court ? `${r.court}.` : "",
        r.docketNumber ? `Docket ${r.docketNumber}.` : "",
        r.suitNature ? `Nature of suit: ${r.suitNature}.` : "",
        (r.opinions ?? [])
          .map((o) => (o.snippet ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " "))
          .filter(Boolean)
          .join(" … ")
          .slice(0, 700),
      ]
        .filter(Boolean)
        .join(" "),
      url: `https://www.courtlistener.com${r.absolute_url}`,
      published_at: r.dateFiled ? new Date(r.dateFiled) : new Date(),
      authors: r.court ? [r.court] : [],
      raw_payload: { docket: r.docketNumber ?? null, court: r.court ?? null },
    }))

  // No client-side domain filter here, unlike the other lanes. CourtListener
  // ANDs the query across the full opinion text server side, so every result
  // already contains both terms. Re-filtering on the fragment we display would
  // only discard cases whose match fell outside the quoted snippet.
  return items.slice(0, 6)
}

// ---------------------------------------------------------------------------
// Regulation — the Federal Register carries proposed rules and their comment
// periods. A proposed rule is visible six to eighteen months before it binds
// anyone, and an open comment period is a door the creator can walk through.
// ---------------------------------------------------------------------------

type FederalRegisterDoc = {
  document_number?: string
  title?: string
  abstract?: string
  html_url?: string
  publication_date?: string
  type?: string
  agencies?: Array<{ name?: string }>
  comments_close_on?: string | null
}

export async function fetchRegulation(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const params = new URLSearchParams({
    // The salient terms unquoted, so the Federal Register ANDs them. Quoting a
    // phrase the topic does not literally contain returns nothing, and quoting
    // only "artificial intelligence" returns every AI notice the government
    // published that week. The regulator's own acronym, when the topic carries
    // one, is the single highest-signal term available here.
    "conditions[term]": domainTerms(topic).slice(0, 2).join(" ") || keyTerms(topic, 2).join(" "),
    "conditions[publication_date][gte]": daysAgoISO(Math.max(hoursBack / 24, 120)),
    order: "newest",
    per_page: "20",
    "fields[]": "document_number",
  })
  // The repeated fields[] parameter cannot go through URLSearchParams cleanly.
  const fields = [
    "document_number",
    "title",
    "abstract",
    "html_url",
    "publication_date",
    "type",
    "agencies",
    "comments_close_on",
  ]
    .map((f) => `fields[]=${f}`)
    .join("&")

  const base = params.toString().replace("fields%5B%5D=document_number", fields)
  const data = await getJson<{ results?: FederalRegisterDoc[] }>(
    `https://www.federalregister.gov/api/v1/documents.json?${base}`,
  )

  const items: RawFeedItem[] = (data?.results ?? [])
    .filter((d) => d.title && d.html_url)
    .map((d) => ({
      source_key: "regulation:federal-register",
      source_item_id: `fr:${d.document_number}`,
      title: `${d.type ?? "Document"}: ${d.title}`,
      body: [
        d.agencies?.length ? `${d.agencies.map((a) => a.name).filter(Boolean).join(", ")}.` : "",
        // Surfaced deliberately: an open comment period is a way in, and it has
        // a deadline the creator can miss.
        d.comments_close_on ? `COMMENTS CLOSE ${d.comments_close_on}.` : "",
        (d.abstract ?? "").slice(0, 700),
      ]
        .filter(Boolean)
        .join(" "),
      url: d.html_url!,
      published_at: d.publication_date ? new Date(d.publication_date) : new Date(),
      authors: d.agencies?.map((a) => a.name ?? "").filter(Boolean) ?? [],
      raw_payload: { comments_close_on: d.comments_close_on ?? null, type: d.type ?? null },
    }))

  return filterByDomainTerms(items, topic).slice(0, 8)
}

// ---------------------------------------------------------------------------
// Standards — what "compliant" is going to mean. Drafts circulate long before
// anyone has to meet them, and almost nobody reads them.
// ---------------------------------------------------------------------------

const STANDARDS_DOMAINS = [
  "nist.gov",
  "iso.org",
  "cencenelec.eu",
  "iec.ch",
  "ieee.org",
  "etsi.org",
  "digital-strategy.ec.europa.eu",
]

export async function fetchStandards(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const key = process.env.EXA_API?.trim() || process.env.EXA_API_KEY?.trim()
  if (!key) throw new Error("EXA_API not set")
  const exa = new Exa(key)

  const res = await exa.searchAndContents(`${topic} standard OR framework OR draft guidance`, {
    numResults: 6,
    type: "auto",
    includeDomains: STANDARDS_DOMAINS,
    startPublishedDate: daysAgoISO(Math.max(hoursBack / 24, 365)),
    text: { maxCharacters: 900 },
  })

  return (res.results ?? [])
    .filter((r) => r.url && r.title)
    .map((r) => ({
      source_key: "standards:bodies",
      source_item_id: r.url!,
      title: r.title!.trim(),
      body: typeof r.text === "string" ? r.text.trim().slice(0, 1000) : "",
      url: r.url!,
      published_at: r.publishedDate ? new Date(r.publishedDate) : new Date(),
      authors: [],
      raw_payload: { lane: "standards" },
    }))
}

// ---------------------------------------------------------------------------
// Code — what engineers actually adopt. Repository activity leads vendor
// announcements, because the thing has to be built before it can be announced.
// ---------------------------------------------------------------------------

type GithubRepo = {
  full_name?: string
  html_url?: string
  description?: string | null
  stargazers_count?: number
  pushed_at?: string
  created_at?: string
  topics?: string[]
  language?: string | null
}

export async function fetchCode(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const since = daysAgoISO(Math.max(hoursBack / 24, 180))
  // GitHub ANDs the terms against name, description and readme, so a four word
  // phrase matches nothing. Two terms, with a domain word preferred over the
  // generic AI vocabulary that every repo already carries.
  const terms = [...domainTerms(topic).slice(0, 2), ...keyTerms(topic, 2)].slice(0, 2)
  const q = `${terms.join(" ")} created:>${since}`
  const data = await getJson<{ items?: GithubRepo[] }>(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=20`,
    { headers: { Accept: "application/vnd.github+json" } },
  )

  const items: RawFeedItem[] = (data?.items ?? [])
    .filter((r) => r.full_name && r.html_url)
    // A repo nobody has starred is somebody's weekend, not a signal.
    .filter((r) => (r.stargazers_count ?? 0) >= 3)
    .map((r) => ({
      source_key: "code:github",
      source_item_id: `gh:${r.full_name}`,
      title: `${r.full_name} (${r.stargazers_count ?? 0} stars)`,
      body: [
        r.description ?? "",
        r.language ? `Written in ${r.language}.` : "",
        r.topics?.length ? `Tagged: ${r.topics.slice(0, 8).join(", ")}.` : "",
        r.pushed_at ? `Last pushed ${r.pushed_at.slice(0, 10)}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      url: r.html_url!,
      published_at: r.created_at ? new Date(r.created_at) : new Date(),
      authors: [r.full_name!.split("/")[0]],
      raw_payload: { stars: r.stargazers_count ?? 0, language: r.language ?? null },
    }))

  // Sorting by stars without this returns whichever unrelated megarepo happens
  // to contain the word: a probe for LLM audit tooling led with a Chinese
  // government simulation game at 16k stars.
  return filterByDomainTerms(items, topic).slice(0, 6)
}

// ---------------------------------------------------------------------------
// Models — what shipped on Hugging Face. Capability is measurable here rather
// than asserted, which is the difference between a claim and a demonstration.
// ---------------------------------------------------------------------------

type HfModel = {
  id?: string
  downloads?: number
  likes?: number
  createdAt?: string
  pipeline_tag?: string
  tags?: string[]
}

/**
 * Topic-independent, unlike every other adapter here.
 *
 * Searching Hugging Face by the creator's subject matches the model ID as a
 * substring and returns hobby projects that happen to have "artificial
 * intelligence" in their name. It cannot answer "what is happening in audit",
 * and it was never the right question to ask it.
 *
 * What it does answer is what actually shipped and what people are actually
 * running, which is the honest version of a capability claim. So this lane is
 * swept once per run like releases, and reports the most-downloaded models
 * published inside the window regardless of topic.
 */
export async function fetchModels(_topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const since = new Date(Date.now() - Math.max(hoursBack, 24 * 30) * 3600000)
  // Sorted by creation, not by downloads. Sorting by downloads returns the
  // all-time leaderboard, which is by definition old, and every one of those
  // rows was then dropped by the recency filter: the lane returned zero on
  // every topic of a live sweep.
  const data = await getJson<HfModel[]>(
    "https://huggingface.co/api/models?sort=createdAt&direction=-1&limit=200&full=false",
  )

  return (data ?? [])
    .filter((m) => m.id)
    .filter((m) => m.createdAt && new Date(m.createdAt) >= since)
    // Traction, so this reports what people are running rather than everything
    // anyone uploaded this week.
    .filter((m) => (m.downloads ?? 0) >= 50 || (m.likes ?? 0) >= 3)
    .sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0))
    .slice(0, 6)
    .map((m) => ({
      source_key: "models:huggingface",
      source_item_id: `hf:${m.id}`,
      title: `Model: ${m.id}`,
      body: [
        m.pipeline_tag ? `Task: ${m.pipeline_tag}.` : "",
        `${(m.downloads ?? 0).toLocaleString()} downloads, ${m.likes ?? 0} likes.`,
        m.tags?.length ? `Tags: ${m.tags.slice(0, 10).join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      url: `https://huggingface.co/${m.id}`,
      published_at: m.createdAt ? new Date(m.createdAt) : new Date(),
      authors: [m.id!.split("/")[0]],
      raw_payload: { downloads: m.downloads ?? 0, likes: m.likes ?? 0 },
    }))
}

export const PRIMARY_ADAPTERS: Record<
  PrimaryLane,
  (topic: string, hoursBack: number) => Promise<RawFeedItem[]>
> = {
  patents: fetchPatents,
  filings: fetchFilings,
  courts: fetchCourts,
  funding: fetchFunding,
  regulation: fetchRegulation,
  standards: fetchStandards,
  code: fetchCode,
  models: fetchModels,
}

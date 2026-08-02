import Exa from "exa-js"
import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"
import { filterByDomainTerms } from "./primary"

/**
 * First signal.
 *
 * The rest of the desk reads institutions: what a regulator proposed, what a
 * standards body drafted, what a court held. Those are real and they are also
 * downstream, because an institution can only publish about something after it
 * exists and someone has noticed.
 *
 * These lanes sit upstream of that. They answer what is being funded, what is
 * being built, what shipped this week and what the state is asking someone to
 * invent. The lag is the whole point:
 *
 *   changelogs     capability, the day it became available
 *   ventures       capital committed to a specific future, before the product
 *   grants         funded research at award, ~2y before the paper
 *   solicitations  the state specifying technology that does not exist, 2-4y out
 *
 * The bar for this tier is different from the primary lanes. There, the value
 * is that the document is authoritative. Here, the value is that almost nobody
 * has read it yet.
 */


export type FrontierLane = "changelogs" | "ventures" | "grants" | "solicitations"

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
}

function getExa(): Exa {
  const key = process.env.EXA_API?.trim() || process.env.EXA_API_KEY?.trim()
  if (!key) throw new Error("EXA_API not set")
  return new Exa(key)
}

/**
 * Paths that live on the right domain and are the wrong thing.
 *
 * A domain allowlist cannot express "openai.com but not its job board", and
 * both showed up on the first run: a careers posting arrived in changelogs and
 * the NSF paper repository arrived in solicitations, which is a different lane
 * entirely and one the desk already reads.
 */
const WRONG_PATHS = [/\/careers?\//i, /\/jobs?\//i, /par\.nsf\.gov/i, /\/people\//i]

async function domainScoped(
  lane: FrontierLane,
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
    .filter((r) => !WRONG_PATHS.some((re) => re.test(r.url!)))
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

// ---------------------------------------------------------------------------
// Changelogs — what a model or platform can do that it could not do last week.
// A changelog entry precedes the blog post by days and the coverage by weeks,
// and it is written for people who will use the thing rather than write about
// it, so it says what actually changed.
// ---------------------------------------------------------------------------

const CHANGELOG_DOMAINS = [
  "docs.anthropic.com",
  "anthropic.com",
  "platform.openai.com",
  "openai.com",
  "help.openai.com",
  "ai.google.dev",
  "deepmind.google",
  "learn.microsoft.com",
  "huggingface.co",
  "docs.mistral.ai",
]

export async function fetchChangelogs(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  // Deliberately not filtered to the creator's domain terms. Capability is
  // topic-independent: a model that can now read a hundred page PDF reliably
  // matters to an audit audience whether or not the release note says "audit".
  return domainScoped(
    "changelogs",
    "changelogs:vendors",
    `${topic} release notes OR changelog OR now available OR added support`,
    CHANGELOG_DOMAINS,
    Math.max(hoursBack / 24, 45),
  )
}

// ---------------------------------------------------------------------------
// Ventures — who put money behind a specific future.
//
// The single earliest hard signal available. A regulator can consult for two
// years about whether a thing should exist; a seed round means someone has
// already decided it will, and has hired people to build it. An agent-native
// firm in the creator's own profession is a story no institution can tell,
// because it is not a position, it is a competitor.
// ---------------------------------------------------------------------------

const VENTURE_DOMAINS = [
  "ycombinator.com",
  "techcrunch.com",
  "sifted.eu",
  "producthunt.com",
  "businesswire.com",
  "prnewswire.com",
  "news.crunchbase.com",
  "axios.com",
  "fortune.com",
]

export async function fetchVentures(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const items = await domainScoped(
    "ventures",
    "ventures:formation",
    `${topic} startup raises seed funding OR launches OR founded agent`,
    VENTURE_DOMAINS,
    Math.max(hoursBack / 24, 120),
    8,
  )
  // These domains cover every sector, so an unfiltered query returns whichever
  // round happened to be announced loudest that week.
  return filterByDomainTerms(items, topic)
}

// ---------------------------------------------------------------------------
// Grants — funded research at the moment of award.
//
// A grant record carries an abstract, a budget and named participants roughly
// two years before the paper and four before anything ships.
//
// CORDIS only. UKRI's Gateway to Research was built here first and then removed:
// it is a real, reachable, well documented JSON API whose `q` parameter does not
// rank by relevance. A query for "machine learning healthcare diagnosis"
// returned mushroom substrate, vessel monitoring and hurricane damage, and of a
// hundred paginated results only four were inside a year. Keeping it meant
// either noise or nothing, and both are worse than the honest absence of a
// second funder.
//
// It was verified as reachable rather than as useful, which is the actual
// lesson. An endpoint answering 200 says nothing about whether its search works.
// ---------------------------------------------------------------------------

export async function fetchGrants(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const days = Math.max(hoursBack / 24, 365)

  return domainScoped(
    "grants",
    "grants:cordis",
    `${topic} project funded objective`,
    ["cordis.europa.eu"],
    days,
    8,
  )
}

// ---------------------------------------------------------------------------
// Solicitations — the state describing technology that does not exist yet.
//
// A programme announcement is a specification with money attached, published
// two to four years before anything commercial appears. It is also the clearest
// available statement of what a government believes is about to be possible.
// ---------------------------------------------------------------------------

const SOLICITATION_DOMAINS = [
  "darpa.mil",
  "iarpa.gov",
  "arpa-h.gov",
  "sbir.gov",
  "dodsbirsttr.mil",
  // www.nsf.gov only: par.nsf.gov is the public access paper repository, which
  // is the papers lane wearing this lane's domain.
  "new.nsf.gov",
  "beta.nsf.gov",
  "ukri.org",
  "nist.gov",
]

export async function fetchSolicitations(topic: string, hoursBack: number): Promise<RawFeedItem[]> {
  const items = await domainScoped(
    "solicitations",
    "solicitations:agencies",
    `${topic} broad agency announcement OR program solicitation OR seeking proposals OR opportunity closes`,
    SOLICITATION_DOMAINS,
    Math.max(hoursBack / 24, 270),
  )
  return filterByDomainTerms(items, topic)
}

export const FRONTIER_ADAPTERS: Record<
  FrontierLane,
  (topic: string, hoursBack: number) => Promise<RawFeedItem[]>
> = {
  changelogs: fetchChangelogs,
  ventures: fetchVentures,
  grants: fetchGrants,
  solicitations: fetchSolicitations,
}

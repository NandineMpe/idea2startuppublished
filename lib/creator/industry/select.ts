import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "../query"
import { bandFor, horizonLabel, LANE_HORIZON_BY_LANE, type HorizonBand } from "./definitions"

/**
 * Which signals belong to an industry, decided by a rule rather than by a model.
 *
 * Selection is deterministic on purpose. A dossier is only worth reading if the
 * evidence under it was chosen by something the creator can inspect and correct,
 * and if a claim about audit turns out to rest on an insurance filing she needs
 * to be able to see why rather than be told the model thought it was relevant.
 *
 * It also means the expensive pass reads forty signals rather than a thousand,
 * which is the difference between a dossier that can be rebuilt weekly and one
 * that cannot be afforded at all.
 */

export type SelectedSignal = {
  id: string
  title: string
  url: string | null
  snippet: string | null
  published_at: string | null
  lane: string
  band: HorizonBand
  /** How many distinct match terms hit. Ranks within a lane. */
  score: number
}

export type SignalRow = {
  id: string
  source_key: string
  title: string
  url: string | null
  snippet: string | null
  published_at: string | null
  topics: string[] | null
}

/** The lane is the part of source_key before the colon: "patents:uspto" -> "patents". */
export function laneOf(sourceKey: string): string {
  return (sourceKey || "").split(":")[0]
}

/**
 * Word-boundary matching, case-insensitive.
 *
 * Substring matching put every "EY" match on anything containing "they", and
 * "SEC" on every "section". A dossier whose evidence is visibly wrong is worse
 * than no dossier, because it discredits the claims that were right.
 */
function countMatches(haystack: string, terms: string[]): number {
  const text = haystack.toLowerCase()
  let hits = 0
  for (const term of terms) {
    const t = term.toLowerCase()
    // Escaped so a term containing regex punctuation cannot break the pattern.
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text)) hits++
  }
  return hits
}

/**
 * The second axis. A signal must be about the industry AND about the technology.
 *
 * Matching on the industry alone selected exactly the wrong corpus: an audit
 * dossier built on "Board Gender Diversity and Audit Committee Meetings on
 * Earnings Management", a financial reporting dossier resting on a securities
 * class action solicitation, and an investment banking forecast whose leading
 * evidence was a vendor's sales vacancy. Every one of them contains the industry
 * word and none of them is evidence of anything she covers.
 *
 * This is the same failure that let cargo theft and Medicaid articles through
 * the opportunities lanes, and it has the same fix: relevance is a conjunction,
 * not a keyword.
 */
export const TECH_TERMS = [
  "AI", "artificial intelligence", "machine learning", "ML", "LLM", "large language model",
  "generative", "GenAI", "neural", "deep learning", "algorithm", "algorithmic",
  "automation", "automated", "autonomous", "agent", "agentic", "copilot", "chatbot",
  "model", "GPT", "Claude", "Gemini", "Llama", "transformer", "foundation model",
  "predictive analytics", "data science", "robotic process", "RPA", "digital transformation",
  "software", "platform", "system", "technology", "tool",
]

/**
 * The technology words that are too weak to qualify on their own.
 *
 * "model" matches every financial model, "system" matches every internal control
 * system, and "technology" appears in the boilerplate of half the corpus. They
 * stay in the vocabulary because they are real evidence alongside a stronger
 * term, and they cannot carry a signal by themselves.
 */
const WEAK_TECH_TERMS = new Set(["model", "system", "technology", "tool", "software", "platform", "agent"])

const STRONG_TECH_TERMS = TECH_TERMS.filter((t) => !WEAK_TECH_TERMS.has(t.toLowerCase()))

/**
 * Combined depth required across both axes.
 *
 * One industry word plus one technology word admits a construction-compliance
 * paper to an audit dossier, because both words genuinely appear once each.
 * Three asks the signal to be substantially about both, which is the difference
 * between evidence and a coincidence of vocabulary.
 *
 * Measured against the live corpus rather than guessed. At 1 the audit dossier
 * drew on a drone multiphysics paper. At 4 the precision held but financial
 * reporting fell to six signals and stopped being buildable at all. At 3 all
 * four industries clear the bar and the top-ranked evidence is identical to
 * what 4 produced, so the extra strictness was only ever cutting the tail.
 */
export const MIN_SCORE = 3

/**
 * Distinct industry terms a body needs when the title does not name the
 * industry. Two was measurably looser without adding anything worth having.
 */
export const MIN_SNIPPET_DEPTH = 3

/** Signals per lane, so eighty filings cannot drown four patents. */
export const MAX_PER_LANE = 6
/** Mirrors the build's refusal threshold, so the cap cannot cause a refusal. */
const MIN_BUILDABLE = 8
/** Total handed to the model. Enough for an arc, small enough to afford weekly. */
export const MAX_SIGNALS = 60

/**
 * Every signal available to score, fetched once.
 *
 * Split out because the screen needs a count for fourteen industries at a time.
 * Calling the whole selection per industry meant fourteen three-thousand-row
 * reads on a single page render, which is the sort of thing that is invisible
 * in development and doubles the load time in production.
 */
export async function loadScorableSignals(
  supabase: SupabaseClient,
  userId: string,
): Promise<SignalRow[]> {
  return safeRows<SignalRow>(
    supabase
      .schema("creator")
      .from("creator_signals")
      .select("id,source_key,title,url,snippet,published_at,topics")
      .eq("user_id", userId)
      .order("published_at", { ascending: false })
      .limit(3000),
  )
}

export async function selectIndustrySignals(
  supabase: SupabaseClient,
  userId: string,
  matchTerms: string[],
  weakTerms: string[] = [],
): Promise<SelectedSignal[]> {
  if (!matchTerms.length) return []
  return selectFromRows(await loadScorableSignals(supabase, userId), matchTerms, weakTerms)
}

/** The selection itself, over rows already in hand. */
export function selectFromRows(
  rows: SignalRow[],
  matchTerms: string[],
  weakTerms: string[] = [],
): SelectedSignal[] {
  if (!matchTerms.length) return []

  // Terms strong enough to be the reason a document was selected. The weak ones
  // still score, they just cannot carry the title on their own.
  const weak = new Set(weakTerms.map((t) => t.toLowerCase()))
  const qualifyingTerms = matchTerms.filter((t) => !weak.has(t.toLowerCase()))

  const scored: SelectedSignal[] = []
  // Same paper syndicated across two feeds is one piece of evidence, and a
  // dossier citing it twice looks like two independent sources when it is not.
  const seenTitles = new Set<string>()

  for (const row of rows) {
    // Title and snippet only. `topics` holds the query that retrieved the
    // signal, not a description of it, so matching against it made every item
    // pulled in by an audit-flavoured search count as audit evidence: a drone
    // multiphysics paper and a childhood obesity study both qualified. The
    // snippet is the document's own words and is fair game; the topic is ours.
    const haystack = [row.title, row.snippet ?? ""].join(" ")

    // The industry has to be in the TITLE, not merely somewhere in the text.
    //
    // This is the rule that lets the screen cover industries beyond the four
    // her corpus is dense in. Scoring over title and snippet was tuned on audit
    // and legal, where almost everything matching is genuinely about them, and
    // it collapses the moment it is pointed at a sparse industry: measured
    // across seven candidates it ranked a cognitive-impairment paper as leading
    // evidence for energy, an accounting paper as leading evidence for
    // cybersecurity, and returned eleven confident signals for public
    // administration when the true answer was zero. A snippet is 260 characters
    // of context in which any word can appear in passing. A title is what the
    // document says it is about.
    //
    // Her existing four all still clear the bar under this rule, with visibly
    // better top-ranked evidence, so it is a straight improvement rather than a
    // trade. The sparse ones now honestly report as thin, which is the point:
    // thin is a real state and it is fixable by collecting, whereas confident
    // and wrong is neither.
    //
    // The qualifying set excludes the industry's own generic words, for the
    // same reason the technology axis excludes "model" and "system". Measured:
    // "assurance" alone was putting an anomaly-detection paper on breast MRI
    // into the audit dossier, and "curriculum" would put every curriculum
    // learning paper into education.
    //
    // The second clause is the escape hatch, and it earns its place. A title
    // rule alone dropped financial reporting below the buildable threshold, and
    // the document it was excluding was an SEC Chief Accountant's speech on
    // trust in the capital markets: unmistakably the right evidence, with a
    // title that names none of it. Requiring three DISTINCT industry terms in
    // the body is the difference between a document that keeps returning to the
    // industry in its own vocabulary and one that mentions it once in passing.
    // Measured against the whole corpus, it restored the speech and admitted
    // nothing at all to the industries that genuinely have no evidence yet.
    const titleNamesIt = countMatches(row.title, qualifyingTerms) > 0
    if (!titleNamesIt && countMatches(row.snippet ?? "", qualifyingTerms) < MIN_SNIPPET_DEPTH) continue

    const industryHits = countMatches(haystack, matchTerms)

    // The conjunction. Relevance to her is the intersection, never either half.
    const techHits = countMatches(haystack, STRONG_TECH_TERMS)
    if (techHits === 0) continue

    if (industryHits + techHits < MIN_SCORE) continue

    const key = row.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 90)
    if (seenTitles.has(key)) continue
    seenTitles.add(key)

    const lane = laneOf(row.source_key)
    scored.push({
      id: row.id,
      title: row.title,
      url: row.url,
      snippet: row.snippet,
      published_at: row.published_at,
      lane,
      band: bandFor(lane),
      // Both axes count. A signal deep in the industry and deep in the
      // technology outranks one that glances off each.
      score: industryHits + techHits,
    })
  }

  // Best-matching first within each lane, then the most recent of equals: an
  // older signal that matches on six terms says more about an industry than a
  // yesterday's item that glanced off one.
  const byLane = new Map<string, SelectedSignal[]>()
  for (const s of scored) {
    const list = byLane.get(s.lane) ?? []
    list.push(s)
    byLane.set(s.lane, list)
  }

  const capped: SelectedSignal[] = []
  const cut: SelectedSignal[] = []
  for (const [, list] of byLane) {
    list.sort((a, b) => b.score - a.score || (b.published_at ?? "").localeCompare(a.published_at ?? ""))
    capped.push(...list.slice(0, MAX_PER_LANE))
    cut.push(...list.slice(MAX_PER_LANE))
  }

  // The per-lane cap must not be what makes an industry unbuildable.
  //
  // It exists so eighty filings cannot drown four patents, which is a rule
  // about proportion in a rich industry. Applied to a thin one it does
  // something it was never meant to: financial reporting had eight qualifying
  // signals and the cap returned seven, one short of the threshold, so the
  // dossier refused on a truncation rather than on the evidence. Whatever the
  // cap removed comes back, best-scoring first, only until the industry is
  // buildable and never beyond it.
  if (capped.length < MIN_BUILDABLE && cut.length) {
    cut.sort((a, b) => b.score - a.score || (b.published_at ?? "").localeCompare(a.published_at ?? ""))
    capped.push(...cut.slice(0, MIN_BUILDABLE - capped.length))
  }

  // Leading registers first in what reaches the model. They are the scarce and
  // valuable half, and if anything is truncated it should be the news.
  const bandRank: Record<HorizonBand, number> = { ahead: 0, present: 1, behind: 2 }
  capped.sort(
    (a, b) => bandRank[a.band] - bandRank[b.band] || b.score - a.score,
  )

  return capped.slice(0, MAX_SIGNALS)
}

/** Signals grouped for the prompt and for the count that ships with the dossier. */
export function countByBand(signals: SelectedSignal[]): Record<HorizonBand, number> {
  return {
    ahead: signals.filter((s) => s.band === "ahead").length,
    present: signals.filter((s) => s.band === "present").length,
    behind: signals.filter((s) => s.band === "behind").length,
  }
}

/**
 * The evidence block, indexed so the model can cite by number.
 *
 * Explicit `N:` indexing rather than asking for structured citations: the model
 * returns an index, code resolves it back to the real signal, and a citation can
 * therefore never point at a URL that does not exist.
 */
export function evidenceBlock(signals: SelectedSignal[]): string {
  const bands: Array<[HorizonBand, string]> = [
    ["ahead", "LEADING REGISTERS (these are the future, dated by their own lead time)"],
    ["present", "PRESENT REGISTERS (shipped, filed, or in force now)"],
    ["behind", "LAGGING REGISTERS (what already broke)"],
  ]

  return bands
    .map(([band, heading]) => {
      const inBand = signals.filter((s) => s.band === band)
      if (!inBand.length) return `${heading}\n- none in the corpus`
      const lines = inBand
        .map((s) => {
          const i = signals.indexOf(s)
          const when = s.published_at ? s.published_at.slice(0, 10) : "undated"
          const horizon = horizonLabel(s.lane)
          const reads = LANE_HORIZON_BY_LANE.get(s.lane as never)?.reads ?? ""
          return `${i}: [${s.lane}, ${horizon}${reads ? `, reads as ${reads}` : ""}] ${when} — ${s.title}${
            s.snippet ? ` :: ${s.snippet.slice(0, 260)}` : ""
          }`
        })
        .join("\n")
      return `${heading}\n${lines}`
    })
    .join("\n\n")
}

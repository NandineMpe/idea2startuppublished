import type { ResearchLane } from "@/lib/creator/research/lanes"

/**
 * Industries, and how far ahead each register lets you see.
 *
 * The research lanes were already collecting the right material and it was
 * arriving as a thousand unrelated items. A PCAOB inspection finding, a Big Four
 * job posting and a patent application read as three headlines, and the thing
 * that makes them worth more than three headlines is that they are three
 * different distances from the same event.
 *
 * That is the whole idea here. Registers have lead times. A patent is a claim on
 * something that ships in two or three years. A job posting is a team being
 * assembled six months before the system it will run. A consultation is a rule
 * twelve to twenty-four months before it binds. An inspection finding is the
 * opposite: it is the past, telling you what already broke.
 *
 * Sorted by lead time, the same thousand signals stop being news and become a
 * timeline with a future end. "AI is changing audit" is a take anyone can have.
 * "Here are the patents filed this year, here is who is being hired, and here is
 * therefore what a 2029 audit file looks like" is a position, and it is only
 * available to someone reading the registers rather than the coverage.
 */

/**
 * Months ahead of visible change, by register.
 *
 * Negative means the register is lagging: it reports damage already done. The
 * ranges are deliberately wide, because the honest claim is "this is early" and
 * not "this arrives in Q3 2028".
 */
export type LaneHorizon = {
  lane: ResearchLane
  /** [earliest, latest] months from signal to visible industry change. */
  months: [number, number]
  /** What this register is evidence OF, in the words the dossier should use. */
  reads: string
}

export const LANE_HORIZONS: LaneHorizon[] = [
  // Furthest ahead: intent and capital, long before product.
  { lane: "patents", months: [18, 36], reads: "what firms are protecting, which is what they intend to ship" },
  { lane: "grants", months: [18, 36], reads: "what public money has decided is worth solving" },
  { lane: "scholarship", months: [12, 30], reads: "capability being demonstrated before it is productised" },
  { lane: "papers", months: [12, 30], reads: "capability being demonstrated before it is productised" },
  { lane: "ventures", months: [12, 24], reads: "where private capital has committed ahead of a market existing" },
  { lane: "funding", months: [12, 24], reads: "where private capital has committed ahead of a market existing" },
  { lane: "consultations", months: [12, 24], reads: "a rule being drafted, roughly two years before it binds" },
  { lane: "standards", months: [12, 24], reads: "the technical settlement that later becomes the compliance floor" },

  // Middle distance: decisions already taken, not yet visible.
  { lane: "supervisors", months: [6, 18], reads: "supervisory attention, which precedes enforcement" },
  { lane: "jobs", months: [6, 12], reads: "teams being assembled before the systems they will run" },
  { lane: "procurement", months: [3, 12], reads: "an institution that has already decided to buy" },
  { lane: "solicitations", months: [3, 12], reads: "an institution that has already decided to buy" },
  { lane: "conferences", months: [3, 9], reads: "the agenda being set before the shift is generally visible" },

  // Present: shipped, filed, in force.
  { lane: "regulation", months: [0, 12], reads: "what is binding now or imminently" },
  { lane: "filings", months: [0, 6], reads: "what companies are prepared to tell investors under liability" },
  { lane: "syscards", months: [0, 6], reads: "what a model's own documentation admits it does and does not do" },
  { lane: "changelogs", months: [0, 6], reads: "capability that has actually shipped" },
  { lane: "releases", months: [0, 6], reads: "capability that has actually shipped" },
  { lane: "models", months: [0, 6], reads: "capability that has actually shipped" },
  { lane: "code", months: [0, 6], reads: "what is being built in the open right now" },
  { lane: "news", months: [0, 0], reads: "coverage, useful for timing rather than for evidence" },
  { lane: "discussion", months: [0, 0], reads: "practitioner sentiment, not evidence" },
  { lane: "books", months: [0, 0], reads: "the argument someone took a year to make" },

  // Lagging: the damage report.
  { lane: "inspections", months: [-18, -3], reads: "what regulators have already found broken in practice" },
  { lane: "courts", months: [-24, -3], reads: "where it has already failed badly enough to litigate" },
  { lane: "retractions", months: [-24, -3], reads: "claims that did not survive scrutiny" },
]

export const LANE_HORIZON_BY_LANE = new Map(LANE_HORIZONS.map((h) => [h.lane, h]))

/** Leading, present or lagging, used to group the evidence on screen. */
export type HorizonBand = "ahead" | "present" | "behind"

export function bandFor(lane: string): HorizonBand {
  const h = LANE_HORIZON_BY_LANE.get(lane as ResearchLane)
  if (!h) return "present"
  if (h.months[1] <= 0) return "behind"
  if (h.months[0] >= 3) return "ahead"
  return "present"
}

export function horizonLabel(lane: string): string {
  const h = LANE_HORIZON_BY_LANE.get(lane as ResearchLane)
  if (!h) return "unknown lead time"
  const [a, b] = h.months
  if (b <= 0) return `${Math.abs(b)} to ${Math.abs(a)} months behind`
  if (a === 0 && b === 0) return "coincident"
  return `${a} to ${b} months ahead`
}

/**
 * The industries this creator actually covers.
 *
 * Seeded from where her signals already cluster rather than from a taxonomy:
 * every one of these has real volume in her corpus today, and an industry with
 * no evidence behind it would produce a dossier that reads as speculation.
 *
 * match_terms are the deterministic selector. Selection is not a model decision,
 * because a dossier is only worth reading if the evidence under it was chosen by
 * a rule the creator can inspect and correct.
 */
export type IndustryDefinition = {
  slug: string
  label: string
  /** Who inside the industry the content is actually for. */
  audience: string
  /** The practice as it stood before any of this, so the arc has a baseline. */
  baseline: string
  match_terms: string[]
}

export const INDUSTRY_SEEDS: IndustryDefinition[] = [
  {
    slug: "audit",
    label: "External audit and assurance",
    audience: "audit seniors, managers and partners, and the inspectors who review them",
    baseline:
      "Audit evidence was gathered by people, sampled by judgement, and defended in a file that a reviewer could walk back to source. Standards assumed a human performed the procedure.",
    match_terms: [
      "audit", "auditor", "assurance", "PCAOB", "FRC", "IAASB", "ISA 500", "audit evidence",
      "Big Four", "PwC", "KPMG", "EY", "Deloitte", "inspection finding", "audit quality",
      "working paper", "sampling", "materiality", "AICPA", "IESBA", "engagement quality",
    ],
  },
  {
    slug: "financial-reporting",
    label: "Financial reporting and disclosure",
    audience: "controllers, financial reporting managers, and investor relations",
    baseline:
      "Disclosure was drafted by people, reviewed by counsel, and tied to internal controls a company had to certify. What a company said about its technology was a marketing question, not a filing question.",
    // Bare "investor", "guidance" and "earnings" are dropped deliberately. They
    // appear in the abstract of anything financial and they were admitting a
    // childhood obesity study to a disclosure dossier.
    match_terms: [
      "SEC", "disclosure", "financial reporting", "internal control", "ICFR", "10-K", "8-K",
      "AI washing", "material weakness", "restatement", "IFRS", "FASB", "earnings management",
      "investor relations", "securities", "enforcement action", "annual report", "audit committee",
    ],
  },
  {
    slug: "legal",
    label: "Legal practice and the courts",
    audience: "in-house counsel, litigators, and the compliance teams that brief them",
    baseline:
      "Legal work was billed by the hour, research was done by juniors, and every citation in a filing was something a person had read. Authority came from precedent a human had located.",
    match_terms: [
      "court", "litigation", "counsel", "law firm", "judge", "ruling", "filing brief",
      "copyright", "fair use", "sanction", "hallucinated citation", "fake citation",
      "discovery", "privilege", "bar association", "settlement", "class action", "damages",
    ],
  },
  {
    slug: "insurance",
    label: "Insurance underwriting and claims",
    audience: "underwriters, actuaries, and claims leads",
    baseline:
      "Risk was priced from actuarial tables and underwriter judgement, and a declined claim could be explained by a person who made the decision.",
    match_terms: [
      "insurance", "insurer", "underwriting", "actuarial", "claims", "premium", "reinsurance",
      "loss ratio", "policyholder", "solvency", "EIOPA", "NAIC", "risk pricing", "adverse selection",
    ],
  },
  // Investment banking is deliberately absent.
  //
  // It was seeded, measured, and cut: after the relevance fixes the corpus held
  // nine matching signals across two registers, and the leading evidence was a
  // cybersecurity framework paper and an underwriting product manager vacancy.
  // A dossier built on that would have looked exactly as authoritative as the
  // audit one and been worth nothing, which is the failure mode this whole
  // screen exists to avoid. It comes back when the research sweep is pointed at
  // it and the evidence is real.
]

export const INDUSTRY_SEED_BY_SLUG = new Map(INDUSTRY_SEEDS.map((i) => [i.slug, i]))

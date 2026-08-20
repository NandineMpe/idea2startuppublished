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
 * The industries this screen covers, in two tiers.
 *
 * The first four are her home ground: audit, reporting, law and insurance, all
 * dense in the corpus today because the research sweep has been reading for
 * them since it was switched on.
 *
 * The rest are industries AI is unmistakably rewriting where her actual subject
 * (who is accountable when the system decides) is the live question, and where
 * the registers are rich enough to forecast from. They are listed with their
 * own search queries, so the sweep collects for them rather than the screen
 * hoping the corpus already knows about them. Until it has, they show as thin
 * and refuse to build, which is the honest state rather than a hidden one.
 *
 * Chosen for register coverage as much as for subject. Hiring has EEOC actions,
 * a New York City audit law and an EU high-risk classification. Public
 * administration has procurement and ombudsman findings. Both forecast well.
 * Something like advertising, where the change is real but the registers are
 * thin, is left out for the same reason investment banking was cut.
 *
 * match_terms are the deterministic selector. Selection is not a model decision,
 * because a dossier is only worth reading if the evidence under it was chosen by
 * a rule the creator can inspect and correct.
 */
/**
 * Below this a build refuses.
 *
 * A dossier standing on seven signals renders identically to one standing on
 * forty, which makes the thin one actively dangerous: it is a guess wearing
 * citations. Refusing is the only honest option, and the card states the count
 * so the refusal is never a surprise.
 */
export const MIN_SIGNALS_TO_BUILD = 8

/** Below this the arc can be written but the forecast is guesswork. */
export const MIN_LEADING_TO_FORECAST = 5

export type IndustryDefinition = {
  slug: string
  label: string
  /** Who inside the industry the content is actually for. */
  audience: string
  /** The practice as it stood before any of this, so the arc has a baseline. */
  baseline: string
  /** Selects evidence already in the corpus. Deterministic, inspectable. */
  match_terms: string[]
  /**
   * Match terms too generic to qualify a document on their own.
   *
   * The mirror of WEAK_TECH_TERMS, and it exists for the same reason. Requiring
   * the industry in the title fixed most of the noise and left a specific
   * residue: single words that are ordinary English in every field. "Assurance"
   * put an unsupervised anomaly detection paper on breast MRI into the audit
   * dossier. "Disclosure" put a paper on PII in database connectors into
   * financial reporting. "Assessment" put a breast cancer prognosis study into
   * education.
   *
   * These still count toward the score, because alongside a real term they are
   * genuine evidence of depth. They just cannot be the reason a document was
   * selected.
   */
  weak_terms?: string[]
  /**
   * Goes out and gets evidence that is not in the corpus yet.
   *
   * The distinction matters more than it looks. The first version of this
   * screen had match terms only, which silently assumed the research sweep was
   * already collecting for every industry it listed. It was not: the sweep
   * reads her canon and her trajectory, both of which are about audit, finance
   * and law. Measured across seven candidate industries, the corpus held real
   * evidence for one of them. Adding an industry without adding collection
   * produces a dossier-shaped hole, or worse, a dossier built on whatever
   * happened to share a word with it.
   */
  search_queries: string[]
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
    weak_terms: ["assurance", "sampling", "working paper"],
    search_queries: ["AI audit evidence", "audit automation regulator", "PCAOB artificial intelligence"],
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
    weak_terms: ["disclosure", "annual report"],
    search_queries: ["AI washing disclosure enforcement", "internal control over financial reporting AI", "SEC artificial intelligence disclosure"],
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
    weak_terms: ["discovery", "privilege", "settlement", "damages", "counsel", "ruling"],
    search_queries: ["AI hallucinated citation sanction", "law firm artificial intelligence court", "generative AI copyright litigation"],
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
    weak_terms: ["claims", "premium"],
    search_queries: ["AI underwriting regulation", "insurance claims automation denial", "algorithmic risk pricing insurer"],
  },
  // ---------------------------------------------------------------------
  // Beyond her home ground. Same test applied: is AI genuinely rewriting the
  // practice, is accountability the live question, and do the registers run
  // deep enough to forecast from rather than only to narrate.
  // ---------------------------------------------------------------------
  {
    slug: "tax",
    label: "Tax administration and advisory",
    audience: "tax advisers, in-house tax leads, and the revenue authorities auditing them",
    baseline:
      "A tax position was a judgement a named person signed, defended with a file of reasoning. Authorities selected cases for enquiry from risk rules a taxpayer could broadly anticipate.",
    match_terms: [
      "tax", "HMRC", "IRS", "transfer pricing", "VAT", "tax authority", "tax return",
      "BEPS", "Pillar Two", "tax compliance", "revenue authority", "tax enquiry", "tax avoidance",
    ],
    search_queries: ["tax authority artificial intelligence enquiry", "HMRC IRS machine learning compliance", "transfer pricing AI documentation"],
  },
  {
    slug: "financial-crime",
    label: "Financial crime, AML and sanctions",
    audience: "financial crime officers, compliance leads, and the supervisors who fine them",
    baseline:
      "Alerts came from written rules, and every escalation was a human decision with a name against it. A closed alert could be explained by the analyst who closed it.",
    match_terms: [
      "anti-money laundering", "money laundering", "sanctions", "financial crime",
      "know your customer", "suspicious activity", "FinCEN", "FATF", "fraud detection",
      "transaction monitoring", "beneficial ownership", "terrorist financing", "de-risking",
    ],
    weak_terms: ["sanctions"],
    search_queries: ["AML transaction monitoring machine learning", "financial crime AI regulator guidance", "sanctions screening automation enforcement"],
  },
  {
    slug: "banking-credit",
    label: "Banking, credit and lending",
    audience: "credit risk teams, model risk validators, and bank supervisors",
    baseline:
      "A declined loan traced back to a scorecard someone could read, and model risk management assumed a model was a documented artefact a validator could open and re-derive.",
    match_terms: [
      "bank", "banking", "central bank", "Federal Reserve", "prudential", "Basel",
      "capital requirement", "stress test", "credit risk", "model risk", "SR 11-7",
      "credit scoring", "lending", "loan", "creditworthiness", "fair lending",
    ],
    weak_terms: ["bank", "stress test"],
    search_queries: ["model risk management machine learning supervisor", "credit scoring AI fair lending", "bank supervisor artificial intelligence guidance"],
  },
  {
    slug: "healthcare",
    label: "Healthcare and clinical practice",
    audience: "clinicians, hospital risk leads, and the regulators clearing the tools",
    baseline:
      "A diagnosis carried the name of the clinician who made it, and liability followed that name. Devices were cleared once against a fixed specification and did not change after approval.",
    match_terms: [
      "clinical", "hospital", "patient", "physician", "diagnosis", "diagnostic",
      "medical", "healthcare", "FDA", "NHS", "radiology", "triage", "clinician",
      "electronic health record", "medical device", "prescribing", "malpractice",
    ],
    search_queries: ["FDA clearance AI clinical decision support", "clinical AI liability malpractice", "hospital artificial intelligence deployment regulation"],
  },
  {
    slug: "hiring",
    label: "Hiring and the workplace",
    audience: "HR leaders, employment counsel, and the candidates on the other side of the screen",
    baseline:
      "A rejection came from a person who read the application. Discrimination was proved by showing what a decision-maker knew and did, and there was a decision-maker.",
    match_terms: [
      "hiring", "recruitment", "candidate screening", "employment", "human resources",
      "workforce", "applicant", "EEOC", "employment law", "performance review",
      "employee monitoring", "worker", "job applicant", "resume screening", "bias audit",
    ],
    weak_terms: ["employment", "workforce", "worker"],
    search_queries: ["automated employment decision tool bias audit", "AI hiring discrimination enforcement", "workplace algorithmic management regulation"],
  },
  {
    slug: "public-sector",
    label: "Government and public administration",
    audience: "civil servants, public-law practitioners, and the people on the receiving end of a decision",
    baseline:
      "An administrative decision came with a duty to give reasons and a route to appeal, and the reasons were written by whoever decided.",
    match_terms: [
      "government", "public sector", "welfare", "benefits", "citizen", "council",
      "municipality", "public service", "immigration", "visa", "social security",
      "eligibility", "civil service", "ombudsman", "administrative decision", "public body",
    ],
    weak_terms: ["government", "public service", "benefits", "citizen", "council", "eligibility"],
    search_queries: ["government algorithm benefits decision review", "public sector AI procurement transparency", "automated decision making administrative law"],
  },
  {
    slug: "education",
    label: "Education and assessment",
    audience: "academics, examiners, and the accreditation bodies behind them",
    baseline:
      "A qualification certified that a named person had demonstrated something under observed conditions, and assessment design assumed the work was theirs.",
    match_terms: [
      "university", "student", "education", "school", "teaching", "assessment", "exam",
      "academic integrity", "plagiarism", "curriculum", "classroom", "grading",
      "higher education", "accreditation", "learner", "coursework", "degree",
    ],
    weak_terms: ["assessment", "school", "learner", "grading", "curriculum", "exam", "student", "teaching", "education"],
    search_queries: ["academic integrity generative AI assessment", "university AI policy accreditation", "AI grading education regulation"],
  },
  {
    slug: "journalism",
    label: "Journalism and publishing",
    audience: "editors, publishers, and the lawyers advising them on rights",
    baseline:
      "Copy carried a byline, corrections were owed to a named author, and the right to reuse text was something you bought.",
    match_terms: [
      "journalism", "journalist", "newsroom", "publisher", "publishing", "editorial",
      "media", "fact check", "misinformation", "press", "byline", "news outlet",
      "syndication", "licensing deal", "defamation",
    ],
    weak_terms: ["media", "press", "publishing", "editorial"],
    search_queries: ["publisher AI copyright licensing lawsuit", "newsroom generative AI policy", "AI training data news publisher"],
  },
  {
    slug: "software",
    label: "Software engineering",
    audience: "engineering leads, security teams, and everyone whose tooling this changes first",
    baseline:
      "Code was written and reviewed by people who could explain it, provenance was the commit history, and a junior engineer was how a senior one got made.",
    match_terms: [
      "software engineer", "developer", "programming", "code review", "codebase",
      "open source", "repository", "pull request", "engineering team",
      "technical debt", "software development", "junior developer", "code generation",
      "software supply chain", "licence compliance", "license compliance",
    ],
    weak_terms: ["programming", "repository", "open source"],
    search_queries: ["AI generated code liability provenance", "software supply chain AI security", "developer productivity AI evidence"],
  },
  {
    slug: "cybersecurity",
    label: "Cybersecurity and information security",
    audience: "CISOs, assurance teams, and the auditors who sign off their controls",
    baseline:
      "A control was something you could describe, test once a year, and evidence in a file. Attackers were constrained by how much bespoke effort a target was worth.",
    match_terms: [
      "cybersecurity", "information security", "breach", "ransomware", "phishing",
      "threat actor", "vulnerability", "CISO", "penetration test", "incident response",
      "malware", "attack surface", "zero day", "security operations", "deepfake fraud",
    ],
    weak_terms: ["vulnerability", "breach", "cyber"],
    search_queries: ["AI enabled attack incident regulator", "security operations artificial intelligence controls", "deepfake fraud enterprise breach"],
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

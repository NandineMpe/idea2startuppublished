/**
 * The Creator OS data contract.
 *
 * Every screen imports from here, and the ingestion/derivation pipeline fills these
 * shapes later. Types first means the UI is the spec: if a field is not here, no
 * screen can quietly depend on it.
 *
 * Two deliberate constraints baked into the contract:
 *  - `Confidence` travels with anything derived. A thin corpus produces noise, and
 *    the UI must be able to say so rather than render a confident wrong number.
 *  - View statistics are percentiles, never means. TikTok view counts are power-law;
 *    one viral post makes an average actively misleading.
 */

/** How much the corpus supports a derived claim. Drives whether a screen shows a number at all. */
export type Confidence = "insufficient" | "low" | "usable" | "strong"

/** Minimum corpus sizes at which each confidence level becomes reachable. */
export const CONFIDENCE_THRESHOLDS: Record<Exclude<Confidence, "insufficient">, number> = {
  low: 10,
  usable: 30,
  strong: 75,
}

export function confidenceForSample(sampleSize: number): Confidence {
  if (sampleSize >= CONFIDENCE_THRESHOLDS.strong) return "strong"
  if (sampleSize >= CONFIDENCE_THRESHOLDS.usable) return "usable"
  if (sampleSize >= CONFIDENCE_THRESHOLDS.low) return "low"
  return "insufficient"
}

// ---------------------------------------------------------------------------
// Corpus — what the creator actually published. Ground truth.
// ---------------------------------------------------------------------------

export type CreatorPlatform = "tiktok"

/** Whether we have the spoken content. On a video-first platform this gates everything downstream. */
export type TranscriptStatus = "pending" | "running" | "done" | "failed" | "unavailable"

export type PostMetrics = {
  views: number
  likes: number
  comments: number
  shares: number
  /** Bookmarks. Optional because rows captured before it was collected lack it. */
  saves?: number
}

/**
 * Engagement rate: the share of viewers who did something deliberate.
 *
 * Raw views measure distribution — mostly how far the algorithm pushed a post.
 * Engagement measures whether the content earned a response once it arrived,
 * which is what a brand is buying and what predicts whether a format repeats.
 * A 20k-view post at 12% is a stronger signal than a 1M-view post at 2%.
 *
 * Saves are included and weighted equally: a bookmark is the strongest intent
 * signal on the platform, since it means the viewer expects to come back.
 * Returns null rather than 0 when views are missing, so "unknown" never renders
 * as "nobody engaged".
 */
export function engagementRate(metrics: PostMetrics | null | undefined): number | null {
  if (!metrics || typeof metrics.views !== "number" || metrics.views <= 0) return null
  const actions =
    (metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0) + (metrics.saves ?? 0)
  return (actions / metrics.views) * 100
}

export function formatEngagementRate(rate: number | null): string {
  if (rate === null) return "—"
  return `${rate.toFixed(rate >= 10 ? 0 : 1)}%`
}

export type CreatorPost = {
  id: string
  platform: CreatorPlatform
  external_id: string
  url: string | null
  caption: string | null
  transcript: string | null
  transcript_status: TranscriptStatus
  posted_at: string
  duration_seconds: number | null
  /** Null until metrics have been captured at least once. */
  metrics: PostMetrics | null
  /** Metrics are a snapshot, not a time series, until live API access lands. */
  metrics_captured_at: string | null
  pillar_id: string | null
  format_id: string | null
}

export type CorpusSummary = {
  total_posts: number
  transcribed: number
  awaiting_transcript: number
  with_metrics: number
  earliest_post_at: string | null
  latest_post_at: string | null
}

// ---------------------------------------------------------------------------
// Canon — who the creator is, derived from the corpus. Never authored by hand.
// ---------------------------------------------------------------------------

/** A cluster of what the creator actually makes, not what a bio would claim. */
export type CreatorPillar = {
  id: string
  label: string
  description: string | null
  post_count: number
  median_views: number | null
  /** Fraction of total output, 0-1. Reveals over- and under-served pillars. */
  share_of_output: number
}

/** Direction of a format's performance over time. "unknown" until there are repeat metric captures. */
export type FormatTrend = "rising" | "flat" | "decaying" | "unknown"

/** A repeatable structure the creator returns to, with performance attached. */
export type CreatorFormat = {
  id: string
  label: string
  /** Ordered beats, e.g. ["contrarian open", "receipt", "turn"]. */
  structure: string[]
  post_count: number
  median_views: number | null
  trend: FormatTrend
}

/** The negative space (`never_says`) matters more than the positive patterns. */
export type CreatorVoice = {
  openers: string[]
  rhythm_notes: string[]
  vocabulary: string[]
  never_says: string[]
}

export type CreatorTopic = {
  label: string
  /** Relative weight in the corpus, 0-1. */
  weight: number
  /** Topics adjacent but not yet worked — the stretch surface, and the brand-match surface. */
  adjacent: string[]
}

/** The brand-facing read of the canon. Written separately, on demand. */
export type CreatorPositioning = {
  headline: string
  bio_short: string
  bio_long: string
  audience: string
  why_brands: string[]
  proof_points: string[]
  brand_categories: string[]
  not_a_fit: string[]
}

export type CreatorCanon = {
  version: number
  derived_at: string
  /** Corpus size at derivation time, so a stale canon is visible as stale. */
  corpus_size: number
  confidence: Confidence
  pillars: CreatorPillar[]
  formats: CreatorFormat[]
  voice: CreatorVoice | null
  topics: CreatorTopic[]
  positioning: CreatorPositioning | null
}

// ---------------------------------------------------------------------------
// Work — what the agents produced. Always traceable to corpus and canon.
// ---------------------------------------------------------------------------

export type WorkKind = "draft" | "insight" | "deal" | "event" | "move" | "grant"

/** The plan attached to a strategic move — what to do, and what could go wrong. */
export type MoveOutline = {
  category: string
  why_now: string
  realistic_upside: string
  effort: "low" | "medium" | "high"
  first_step: string
  steps: string[]
  risks: string[]
}
export type WorkState = "proposed" | "approved" | "active" | "done" | "killed" | "archived"

/** Which tier of autonomy an item sits in. Auto items report; the rest wait. */
export type WorkAutonomy = "auto" | "approve" | "escalate"

export type WorkProvenance = {
  agent: string
  canon_version: number
  /** Corpus rows the agent reasoned from. Every claim traces back to real posts. */
  source_post_ids: string[]
}

/**
 * Who to approach, and the first thing to do.
 *
 * `confidence` is carried rather than implied because the failure it guards is
 * specific: a plausible invented name at a real organisation wastes the pitch
 * and burns the introduction, where an honest "the commissioning editor, name
 * not published" costs one search.
 */
export type Counterparty = {
  organisation: string
  contact_role: string
  /** Empty unless an individual was named in a source that was actually supplied. */
  contact_name: string
  /** A URL the agent was shown, never one it constructed. */
  contact_route: string
  next_action: string
  confidence: "named" | "role_only" | "unknown"
}

export type CreatorWorkItem = {
  id: string
  kind: WorkKind
  state: WorkState
  autonomy: WorkAutonomy
  title: string
  body: string | null
  /** Why this was produced, in the creator's terms. Shown on the card. */
  rationale: string | null
  provenance: WorkProvenance
  /** Null on drafts, moves, and opportunities proposed before this existed. */
  counterparty: Counterparty | null
  /**
   * The date the opportunity stops existing, YYYY-MM-DD. Null unless a source
   * actually stated one: an estimated deadline is worse than none, because it
   * can reassure the creator that a closed call is still open.
   */
  deadline: string | null
  /**
   * Where the application is made. Carried straight off the register that
   * published the call, never model-written and never constructed, because a
   * wrong apply link is discovered at the deadline rather than before it.
   */
  apply_url: string | null
  /** Who may apply, quoted from the announcement. The first thing that decides a grant. */
  eligibility: string | null
  created_at: string
  decided_at: string | null
}

/**
 * The dossier a draft came from, carried through so the queue keeps the
 * evidence.
 *
 * Joined at read time rather than copied onto the draft: lineage is often
 * derived after the draft was written, and a snapshot would freeze the card at
 * whatever was known the moment the Writer ran.
 */
/**
 * The house script structure: conclusion first, then why today, then the
 * evidence, then a close written to run back into the opening on replay.
 */
export type ScriptSections = {
  point: string
  trigger: string
  analysis: string
  loop: string
  /**
   * Everything below is off the talk track, and null on scripts written before
   * the spec existed.
   */
  /** Claim-by-claim shot notes, newline delimited. Feeds the visual planner. */
  show?: string | null
  /** What the piece sells and where it lands. Empty for editorial, which is most of it. */
  sell?: string | null
  /** One concrete action, on screen after the callback so the spoken seam survives. */
  ask?: string | null
}

/** Mirrors lib/creator/visuals/plan.ts, declared here so the UI contract stays in one file. */
export type VisualPlanShape = {
  cover_concept: string
  cover_text: string
  shots: Array<{
    beat: string
    seconds: number
    on_screen_text: string
    visual: string
    asset_type: string
    source_url: string
    tool: string
  }>
  captures: Array<{ url: string; highlight: string }>
  motif: string
  sound: string
  generated_at: string
}

export type DraftSource = {
  story_id: string
  thesis: string
  why_now: string | null
  /** Carried through so the queue card can say who loses without opening the dossier. */
  stakes: string | null
  open_question: string | null
  primary_emotion: StoryEmotion | null
  output_format: StoryOutputFormat
  move: StoryMove
  receipts: StoryReceipt[]
  lineage: StoryLineage | null
  lineage_state: LineageState
}

/** A drafted piece in the Next Five queue. */
export type CreatorDraft = CreatorWorkItem & {
  kind: "draft"
  format_id: string | null
  pillar_id: string | null
  /** What the piece argues, for the creator scanning their own queue. */
  premise: string | null
  /** The house structure. Null on drafts written before it existed. */
  script_sections: ScriptSections | null
  /** Shot list, planned against the receipts. Null until asked for. */
  visual_plan: VisualPlanShape | null
  /** The opener, surfaced separately because it is what gets judged first. */
  hook: string | null
  estimated_duration_seconds: number | null
  /** Null for drafts written from a direct brief rather than an approved story. */
  source: DraftSource | null
}

// ---------------------------------------------------------------------------
// Stories — the Researcher's dossiers. A story is connected dots with receipts,
// never a restated headline; sub-two-signal candidates stay on the watchlist.
// ---------------------------------------------------------------------------

export type StoryState = "watchlist" | "proposed" | "approved" | "killed" | "published" | "archived"

export type StorySynthesisKind =
  | "connection"
  | "contradiction"
  | "second_order"
  | "trend_break"
  | "own_content"

export type StoryReceipt = {
  signal_id: string
  url: string | null
  title: string
  quote: string
}

export type LineageConfidence = "documented" | "well_known" | "uncertain"

export type LineageEntry = {
  period: string
  event: string
  relevance: string
  verify: string
  confidence: LineageConfidence
}

/** What a story is the latest instance of — the timeline it sits at the end of. */
export type StoryLineage = {
  timeline: LineageEntry[]
  building_on: string
  recurring_question: string
  whats_actually_new: string
  whats_repeating: string
  research_base: Array<{ title: string; url: string | null; what_it_shows: string }>
}

export type LineageState = "none" | "running" | "done" | "failed"

export type CreatorStory = {
  id: string
  state: StoryState
  thesis: string
  synthesis_kind: StorySynthesisKind
  /** Whether this deepens owned ground, stretches sideways, or builds the declared position. */
  move: StoryMove
  receipts: StoryReceipt[]
  why_now: string | null
  angle: string | null
  suggested_pillar_id: string | null
  work_item_id: string | null
  created_at: string
  lineage: StoryLineage | null
  lineage_state: LineageState

  // The candidate gate, stored as filled. A story only exists because it could
  // fill these, so they are the truest short description of it.
  /** Who did something. A document is not an actor. */
  named_actor: string | null
  /** Who loses, who is embarrassed, who changes what, by when. The boredom gate. */
  stakes: string | null
  /** What this card genuinely cannot answer. Curiosity runs on it. */
  open_question: string | null
  /** One sentence, sayable to someone who reads nothing. */
  hook_line: string | null

  /** Replaces why_you: the hole in the story, and the case against it. */
  unknowns: string | null
  kill_reason: string | null

  primary_emotion: StoryEmotion | null
  output_format: StoryOutputFormat
  /** Set only on killed candidates: which gate it failed and why. */
  gate_failure: string | null
  /** The signals this thesis stands on. Used to join the read documents. */
  signal_ids: string[] | null
  /**
   * Documents the desk actually fetched and read, verified only. Attached by
   * loadStories rather than stored on the row, because an extract belongs to a
   * source and several stories can cite the same one.
   */
  extracts?: StoryExtract[]
}

/** A source read in full, with quotes checked character for character against it. */
export type StoryExtract = {
  signal_id: string
  source_url: string
  key_claims: Array<{ quote: string; locator: string; why_it_matters: string }>
  silences: string[]
  verified: boolean
  claims_offered: number
  claims_verified: number
  content_chars: number
}

/**
 * One only, per story. 'knowledge' is the home lane: knowing a thing and
 * feeling you learned it is what earns a completion and a share. The rest are
 * seasoning.
 */
export type StoryEmotion =
  | "knowledge"
  | "amusement"
  | "jolt"
  | "admiration"
  | "inspiration"
  | "craving"
  | "calm"

/** Some good material is a byline and a bad video. Tagged so a routing error is not read as a personal failure. */
export type StoryOutputFormat = "script" | "written" | "artifact"

/** Days from now until a deadline, negative once it has passed. Null when there is no date. */
export function daysUntil(deadline: string | null | undefined): number | null {
  if (!deadline) return null
  const then = new Date(`${deadline}T00:00:00Z`).getTime()
  if (Number.isNaN(then)) return null
  return Math.ceil((then - Date.now()) / (24 * 3600 * 1000))
}

/**
 * Why something was killed.
 *
 * Six, and no more. The taxonomy is small on purpose: a kill has to cost one
 * tap or it will not be labelled, and an unlabelled kill teaches the desk
 * nothing. The labels are also written from the creator's side of the desk
 * ("not me", "too heavy") rather than as an editorial verdict, because that is
 * the judgement actually being made at eleven at night in a queue of five.
 */
export const KILL_REASONS = [
  { id: "boring", label: "Boring", hint: "No stakes. Nothing is at risk for anyone." },
  { id: "too_heavy", label: "Too heavy", hint: "Needs research I do not have time for." },
  { id: "off_brand", label: "Off brand", hint: "Institutional gaze, wrong stance." },
  { id: "not_me", label: "Not me", hint: "True and useful, but not my voice." },
  { id: "done_before", label: "Done before", hint: "Repeats something I have already posted." },
  { id: "wrong_format", label: "Wrong format", hint: "Good material, wrong output type." },
  { id: "weak_receipts", label: "Weak receipts", hint: "I cannot stand this up." },
] as const

export type CreatorKillReason = (typeof KILL_REASONS)[number]["id"]

/** The rolled-up read of every decision, rewritten weekly. Never raw rows in a prompt. */
export type CreatorTaste = {
  window_start: string | null
  window_end: string | null
  approve_count: number
  kill_count: number
  kill_counts: Partial<Record<CreatorKillReason, number>>
  exemplars: Partial<Record<CreatorKillReason, Array<{ subject: string; note: string | null }>>>
  rebuilt_at: string | null
}

export type StoriesContext = {
  proposed: CreatorStory[]
  watchlist: CreatorStory[]
  blocker: CreatorBlocker | null
}

// ---------------------------------------------------------------------------
// Opportunities — the partnerships desk's pipeline of deal/event work items.
// ---------------------------------------------------------------------------

export type CreatorMove = CreatorWorkItem & {
  kind: "move"
  outline: MoveOutline | null
  script: string | null
}

export type OpportunitiesContext = {
  proposed: CreatorWorkItem[]
  active: CreatorWorkItem[]
  done: CreatorWorkItem[]
  /** Strategic moves are a different decision from a deal, so they render apart. */
  moves: CreatorMove[]
  blocker: CreatorBlocker | null
}

// ---------------------------------------------------------------------------
// Worth — what the creator should charge, derived from real distribution.
// ---------------------------------------------------------------------------

/**
 * A defensible rate range for one scope.
 *
 * Percentiles rather than an average: TikTok pays on views, view counts are
 * power-law, and an average is exactly the number a brand uses to lowball.
 */
export type RateBand = {
  scope: "overall" | "pillar" | "format"
  scope_label: string
  sample_size: number
  views_p25: number
  views_median: number
  views_p75: number
  rate_low: number
  rate_high: number
  currency: string
  confidence: Confidence
  /** Posts backing the number. This is what makes the rate arguable in a negotiation. */
  comparable_post_ids: string[]
}

export type WorthSummary = {
  currency: string
  /** Null when the corpus cannot support any defensible number. */
  headline: RateBand | null
  by_pillar: RateBand[]
  by_format: RateBand[]
  computed_at: string | null
  /** Metrics snapshot age — a rate built on stale metrics is a stale rate. */
  metrics_captured_at: string | null
}

// ---------------------------------------------------------------------------
// Screen contexts — one per route, mirroring the careeros loader convention.
// ---------------------------------------------------------------------------

/** Set when a screen cannot render because an upstream step has not happened yet. */
export type CreatorBlocker = {
  reason: "no_corpus" | "no_canon" | "no_metrics" | "insufficient_corpus" | "no_topics" | "no_trajectory"
  /** What the creator can do about it, in one line. */
  action: string
  href: string | null
}

export type DeskContext = {
  corpus: CorpusSummary
  canon: CreatorCanon | null
  /** Items produced overnight that need no decision — the agency reporting in. */
  completed: CreatorWorkItem[]
  /** Items waiting on the creator. This is the real content of the screen. */
  awaiting: CreatorWorkItem[]
  escalations: CreatorWorkItem[]
  last_run_at: string | null
  blocker: CreatorBlocker | null
}

export type NextFiveContext = {
  drafts: CreatorDraft[]
  canon: CreatorCanon | null
  blocker: CreatorBlocker | null
}

export type WorthContext = {
  worth: WorthSummary | null
  corpus: CorpusSummary
  blocker: CreatorBlocker | null
}

export type CanonContext = {
  canon: CreatorCanon | null
  corpus: CorpusSummary
  blocker: CreatorBlocker | null
}

export type CorpusContext = {
  posts: CreatorPost[]
  summary: CorpusSummary
  blocker: CreatorBlocker | null
}

// ---------------------------------------------------------------------------
// Settings — the few inputs that are not derived from the corpus.
// ---------------------------------------------------------------------------

export const SUPPORTED_CURRENCIES = ["USD", "ZAR", "GBP", "EUR"] as const
export type CreatorCurrency = (typeof SUPPORTED_CURRENCIES)[number]

/**
 * Starting CPM band, in currency units per 1,000 views, and the default quote currency.
 *
 * A calibration placeholder rather than a market truth — the only input to Worth not
 * derived from the creator's own data. Overridable in Settings, and worth replacing
 * once real closed-deal figures exist to calibrate against.
 */
export const DEFAULT_CPM_LOW = 20
export const DEFAULT_CPM_HIGH = 40
export const DEFAULT_CURRENCY: CreatorCurrency = "USD"

/**
 * Deliberately small. Anything that can be derived from the corpus is derived, not
 * configured — the exception is the CPM band, which is the one number in Worth with
 * no basis in the creator's own data, so it is surfaced and tunable rather than
 * buried in a constant where it would read as fact.
 */
export type VisualTool = { name: string; url?: string | null; good_for?: string | null }

export type CreatorSettings = {
  currency: CreatorCurrency
  cpm_low: number
  cpm_high: number
  tiktok_handle: string | null
  /** Declared niche topics — the agents' stopgap input until the canon is derived. */
  niche_topics: string[]
  /** What the creator can actually build with. The visual planner routes every shot to one of these. */
  visual_tools: VisualTool[]
}

export type CreatorSettingsContext = {
  settings: CreatorSettings
  /** False until the creator schema exists; the form renders read-only rather than lying about saving. */
  persisted: boolean
}

// ---------------------------------------------------------------------------
// Trajectory — where the creator is going.
//
// The canon describes the corpus. Read alone it makes every agent argue from
// precedent, which is how a creator ends up being handed the same territory back
// forever. This is the other pole: declared intent, plus a strategy derived
// against it. Agents are asked to close the gap between the two.
// ---------------------------------------------------------------------------

/** What is missing between the position held today and the one declared. */
export type TrajectoryGap = {
  gap: string
  why_it_matters: string
  /** The concrete thing that closes it. */
  closes_with: string
}

export type TrajectoryPhase = {
  phase: string
  months: string
  objective: string
  plays: string[]
}

export type CreatorTrajectory = {
  id: string
  version: number
  // Declared. Never rewritten by an agent.
  north_star: string
  /**
   * The one named argument the creator is claiming, phrased as a question they
   * are visibly the deepest source on. Every agent ranks against this, and it
   * outranks the format list.
   */
  flagship_question: string | null
  target_audience: string | null
  what_it_serves: string | null
  /** Where the creator actually is. Drives travel, timezone, and local standing. */
  based_in: string | null
  /** Ordered, most important first. Drives which regulators, press and stages the desk hunts in. */
  target_markets: string[]
  /** Where the audience is today. Unmeasurable from the data we ingest, so it has to be declared. */
  audience_now: string | null
  horizon_months: number
  positions_to_claim: string[]
  off_strategy: string[]
  // Derived.
  position_now: string | null
  gaps: TrajectoryGap[]
  sequence: TrajectoryPhase[]
  proof_needed: string[]
  rooms: string[]
  stop_doing: string[]
  search_territory: string[]
  strategy_derived_at: string | null
}

/** Which pole a story serves: owned ground, the stretch beside it, or the stated destination. */
export type StoryMove = "consolidate" | "expand" | "advance"

/** Where a signal's topic came from. 'horizon' topics have no corpus behind them by design. */
export type SignalStance = "core" | "adjacent" | "horizon"

// ---------------------------------------------------------------------------
// Threads — the things that have not finished happening.
//
// Every other unit on this desk is bounded by a window: what moved in 72 hours,
// what was filed this quarter. That is the clock everyone else is on. A thread
// is the opposite: something reported on a date that is not over, where the
// interesting question is not what happened today but what happened to THAT.
// ---------------------------------------------------------------------------

export type ThreadState = "watching" | "moved" | "dormant" | "closed"

export type ThreadSignificance = "major" | "notable" | "minor" | "none"

export type ThreadReceipt = {
  title: string
  url: string | null
  published_at: string
  lane: string
  quote: string
}

export type ThreadDevelopment = {
  checked_at: string
  moved: boolean
  summary: string
  significance: ThreadSignificance
  receipts: ThreadReceipt[]
  still_open: string[]
  angle: string
}

export type CreatorThread = {
  id: string
  subject: string
  query: string
  origin: "corpus" | "story" | "signal" | "manual"
  anchor_date: string
  what_was_known: string
  open_questions: string[]
  state: ThreadState
  developments: ThreadDevelopment[]
  last_checked_at: string | null
  next_check_at: string
  check_count: number
  work_item_id: string | null
}

export type ThreadsContext = {
  moved: CreatorThread[]
  watching: CreatorThread[]
  dormant: CreatorThread[]
  blocker: CreatorBlocker | null
}

export const NO_TRAJECTORY_BLOCKER: CreatorBlocker = {
  reason: "no_trajectory",
  action:
    "Your agents are working from what you have already published. Say where you are going and they will work toward it instead.",
  href: "/creator/dashboard/trajectory",
}

export const EMPTY_CORPUS_SUMMARY: CorpusSummary = {
  total_posts: 0,
  transcribed: 0,
  awaiting_transcript: 0,
  with_metrics: 0,
  earliest_post_at: null,
  latest_post_at: null,
}

export const NO_CORPUS_BLOCKER: CreatorBlocker = {
  reason: "no_corpus",
  action: "Import your TikTok data export to build the corpus.",
  href: "/creator/dashboard/content",
}

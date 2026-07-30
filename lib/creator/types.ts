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

export type WorkKind = "draft" | "insight" | "deal" | "event"
export type WorkState = "proposed" | "approved" | "active" | "done" | "killed"

/** Which tier of autonomy an item sits in. Auto items report; the rest wait. */
export type WorkAutonomy = "auto" | "approve" | "escalate"

export type WorkProvenance = {
  agent: string
  canon_version: number
  /** Corpus rows the agent reasoned from. Every claim traces back to real posts. */
  source_post_ids: string[]
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
  created_at: string
  decided_at: string | null
}

/** A drafted piece in the Next Five queue. */
export type CreatorDraft = CreatorWorkItem & {
  kind: "draft"
  format_id: string | null
  pillar_id: string | null
  /** The opener, surfaced separately because it is what gets judged first. */
  hook: string | null
  estimated_duration_seconds: number | null
}

// ---------------------------------------------------------------------------
// Stories — the Researcher's dossiers. A story is connected dots with receipts,
// never a restated headline; sub-two-signal candidates stay on the watchlist.
// ---------------------------------------------------------------------------

export type StoryState = "watchlist" | "proposed" | "approved" | "killed" | "published"

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
  receipts: StoryReceipt[]
  why_now: string | null
  why_you: string | null
  angle: string | null
  suggested_pillar_id: string | null
  work_item_id: string | null
  created_at: string
  lineage: StoryLineage | null
  lineage_state: LineageState
}

export type StoriesContext = {
  proposed: CreatorStory[]
  watchlist: CreatorStory[]
  blocker: CreatorBlocker | null
}

// ---------------------------------------------------------------------------
// Opportunities — the partnerships desk's pipeline of deal/event work items.
// ---------------------------------------------------------------------------

export type OpportunitiesContext = {
  proposed: CreatorWorkItem[]
  active: CreatorWorkItem[]
  done: CreatorWorkItem[]
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
  reason: "no_corpus" | "no_canon" | "no_metrics" | "insufficient_corpus" | "no_topics"
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
export type CreatorSettings = {
  currency: CreatorCurrency
  cpm_low: number
  cpm_high: number
  tiktok_handle: string | null
  /** Declared niche topics — the agents' stopgap input until the canon is derived. */
  niche_topics: string[]
}

export type CreatorSettingsContext = {
  settings: CreatorSettings
  /** False until the creator schema exists; the form renders read-only rather than lying about saving. */
  persisted: boolean
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

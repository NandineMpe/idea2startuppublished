import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "./query"
import { percentile } from "./load-worth"
import {
  EMPTY_CORPUS_SUMMARY,
  NO_CORPUS_BLOCKER,
  engagementRate,
  type CorpusContext,
  type CorpusSummary,
  type CreatorPost,
} from "./types"

export type CorpusPerformance = {
  /** Posts carrying metrics — the denominator for everything below. */
  measured: number
  total_views: number
  median_views: number | null
  /** Reach spread, which a single headline number always hides. */
  views_p25: number | null
  views_p75: number | null
  total_likes: number
  total_comments: number
  total_shares: number
  total_saves: number
  /** Median rather than mean: one viral post drags an average somewhere no future post reaches. */
  median_engagement: number | null
  best_engagement: number | null
}

const EMPTY_PERFORMANCE: CorpusPerformance = {
  measured: 0,
  total_views: 0,
  median_views: null,
  views_p25: null,
  views_p75: null,
  total_likes: 0,
  total_comments: 0,
  total_shares: 0,
  total_saves: 0,
  median_engagement: null,
  best_engagement: null,
}

/**
 * Headline performance across the corpus.
 *
 * Totals are summed because a sum of views is a real quantity. Everything
 * describing a typical post uses a percentile instead: view counts are
 * power-law, so a mean describes a post the creator has never made and will
 * not make again.
 */
export function summarisePerformance(posts: CreatorPost[]): CorpusPerformance {
  const measured = posts.filter((p) => p.metrics)
  if (!measured.length) return EMPTY_PERFORMANCE

  const views = measured
    .map((p) => p.metrics!.views)
    .filter((v) => typeof v === "number" && v >= 0)
    .sort((a, b) => a - b)

  const rates = measured
    .map((p) => engagementRate(p.metrics))
    .filter((r): r is number => r !== null)
    .sort((a, b) => a - b)

  const sum = (pick: (m: NonNullable<CreatorPost["metrics"]>) => number | undefined) =>
    measured.reduce((acc, p) => acc + (pick(p.metrics!) ?? 0), 0)

  return {
    measured: measured.length,
    total_views: sum((m) => m.views),
    median_views: views.length ? Math.round(percentile(views, 0.5)) : null,
    views_p25: views.length ? Math.round(percentile(views, 0.25)) : null,
    views_p75: views.length ? Math.round(percentile(views, 0.75)) : null,
    total_likes: sum((m) => m.likes),
    total_comments: sum((m) => m.comments),
    total_shares: sum((m) => m.shares),
    total_saves: sum((m) => m.saves),
    median_engagement: rates.length ? percentile(rates, 0.5) : null,
    best_engagement: rates.length ? rates[rates.length - 1] : null,
  }
}

const POST_COLUMNS =
  "id,platform,external_id,url,caption,transcript,transcript_status,posted_at,duration_seconds,metrics,metrics_captured_at,pillar_id,format_id"

export function summariseCorpus(posts: CreatorPost[]): CorpusSummary {
  if (!posts.length) return EMPTY_CORPUS_SUMMARY

  let transcribed = 0
  let awaiting = 0
  let withMetrics = 0
  let earliest: string | null = null
  let latest: string | null = null

  for (const post of posts) {
    if (post.transcript_status === "done") transcribed++
    if (post.transcript_status === "pending" || post.transcript_status === "running") awaiting++
    if (post.metrics) withMetrics++

    if (!earliest || post.posted_at < earliest) earliest = post.posted_at
    if (!latest || post.posted_at > latest) latest = post.posted_at
  }

  return {
    total_posts: posts.length,
    transcribed,
    awaiting_transcript: awaiting,
    with_metrics: withMetrics,
    earliest_post_at: earliest,
    latest_post_at: latest,
  }
}

export async function loadCreatorPosts(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreatorPost[]> {
  return safeRows<CreatorPost>(
    supabase
      .schema("creator")
      .from("creator_content")
      .select(POST_COLUMNS)
      .eq("user_id", userId)
      .order("posted_at", { ascending: false }),
  )
}

/** Summary only — for screens that need corpus size without paying for every row. */
export async function loadCorpusSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<CorpusSummary> {
  return summariseCorpus(await loadCreatorPosts(supabase, userId))
}

export async function loadCorpus(
  supabase: SupabaseClient,
  userId: string,
): Promise<CorpusContext> {
  const posts = await loadCreatorPosts(supabase, userId)
  const summary = summariseCorpus(posts)

  return {
    posts,
    summary,
    blocker: posts.length ? null : NO_CORPUS_BLOCKER,
  }
}

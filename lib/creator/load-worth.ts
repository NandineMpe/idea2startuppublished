import type { SupabaseClient } from "@supabase/supabase-js"
import { loadCreatorCanon } from "./load-canon"
import { loadCreatorPosts, summariseCorpus } from "./load-corpus"
import { loadCreatorSettings } from "./load-settings"
import {
  CONFIDENCE_THRESHOLDS,
  confidenceForSample,
  NO_CORPUS_BLOCKER,
  type CreatorCanon,
  type CreatorPost,
  type CreatorSettings,
  type RateBand,
  type WorthContext,
  type WorthSummary,
} from "./types"

/**
 * Linear-interpolated percentile over an ascending list.
 *
 * Percentiles rather than a mean throughout: TikTok view counts are power-law, so a
 * single viral post drags an average somewhere no brand will agree to and no future
 * post will reach.
 */
export function percentile(sortedAscending: number[], p: number): number {
  if (!sortedAscending.length) return 0
  if (sortedAscending.length === 1) return sortedAscending[0]

  const rank = (sortedAscending.length - 1) * p
  const low = Math.floor(rank)
  const high = Math.ceil(rank)
  if (low === high) return sortedAscending[low]

  return sortedAscending[low] + (sortedAscending[high] - sortedAscending[low]) * (rank - low)
}

function viewsOf(posts: CreatorPost[]): number[] {
  return posts
    .map((post) => post.metrics?.views)
    .filter((views): views is number => typeof views === "number" && views >= 0)
    .sort((a, b) => a - b)
}

/** A rate band for one scope, or null when no post in scope carries metrics. */
export function buildRateBand(
  scope: RateBand["scope"],
  scopeLabel: string,
  posts: CreatorPost[],
  settings: CreatorSettings,
): RateBand | null {
  const views = viewsOf(posts)
  if (!views.length) return null

  const p25 = percentile(views, 0.25)
  const median = percentile(views, 0.5)
  const p75 = percentile(views, 0.75)

  return {
    scope,
    scope_label: scopeLabel,
    sample_size: views.length,
    views_p25: Math.round(p25),
    views_median: Math.round(median),
    views_p75: Math.round(p75),
    rate_low: Math.round((p25 * settings.cpm_low) / 1000),
    rate_high: Math.round((p75 * settings.cpm_high) / 1000),
    currency: settings.currency,
    confidence: confidenceForSample(views.length),
    comparable_post_ids: posts
      .filter((post) => typeof post.metrics?.views === "number")
      .slice(0, 12)
      .map((post) => post.id),
  }
}

export function buildWorthSummary(
  posts: CreatorPost[],
  canon: CreatorCanon | null,
  settings: CreatorSettings,
): WorthSummary | null {
  const headline = buildRateBand("overall", "All posts", posts, settings)
  if (!headline) return null

  const byPillar: RateBand[] = []
  for (const pillar of canon?.pillars ?? []) {
    const band = buildRateBand("pillar", pillar.label, posts.filter((p) => p.pillar_id === pillar.id), settings)
    if (band) byPillar.push(band)
  }

  const byFormat: RateBand[] = []
  for (const format of canon?.formats ?? []) {
    const band = buildRateBand("format", format.label, posts.filter((p) => p.format_id === format.id), settings)
    if (band) byFormat.push(band)
  }

  const capturedAt =
    posts
      .map((post) => post.metrics_captured_at)
      .filter((at): at is string => Boolean(at))
      .sort()
      .at(-1) ?? null

  return {
    currency: settings.currency,
    headline,
    by_pillar: byPillar.sort((a, b) => b.views_median - a.views_median),
    by_format: byFormat.sort((a, b) => b.views_median - a.views_median),
    computed_at: new Date().toISOString(),
    metrics_captured_at: capturedAt,
  }
}

export async function loadWorth(supabase: SupabaseClient, userId: string): Promise<WorthContext> {
  const [posts, canon, settingsContext] = await Promise.all([
    loadCreatorPosts(supabase, userId),
    loadCreatorCanon(supabase, userId),
    loadCreatorSettings(supabase, userId),
  ])

  const summary = summariseCorpus(posts)

  if (!posts.length) {
    return { worth: null, corpus: summary, blocker: NO_CORPUS_BLOCKER }
  }

  if (!summary.with_metrics) {
    return {
      worth: null,
      corpus: summary,
      blocker: {
        reason: "no_metrics",
        action: "Posts are in, but none carry view counts yet. A rate needs metrics to stand on.",
        href: "/creator/dashboard/content",
      },
    }
  }

  const worth = buildWorthSummary(posts, canon, settingsContext.settings)

  return {
    worth,
    corpus: summary,
    blocker:
      summary.with_metrics < CONFIDENCE_THRESHOLDS.low
        ? {
            reason: "insufficient_corpus",
            action: `Only ${summary.with_metrics} posts carry metrics. Treat this range as directional until there are ${CONFIDENCE_THRESHOLDS.low}.`,
            href: "/creator/dashboard/content",
          }
        : null,
  }
}

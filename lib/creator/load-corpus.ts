import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "./query"
import {
  EMPTY_CORPUS_SUMMARY,
  NO_CORPUS_BLOCKER,
  type CorpusContext,
  type CorpusSummary,
  type CreatorPost,
} from "./types"

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

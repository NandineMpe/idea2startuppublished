import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRow } from "./query"
import { loadCorpusSummary } from "./load-corpus"
import {
  CONFIDENCE_THRESHOLDS,
  NO_CORPUS_BLOCKER,
  type CanonContext,
  type CreatorBlocker,
  type CreatorCanon,
} from "./types"

const CANON_COLUMNS =
  "version,derived_at,corpus_size,confidence,pillars,formats,voice,topics,positioning"

/** Latest canon version for the creator, or null before first derivation. */
export async function loadCreatorCanon(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreatorCanon | null> {
  return safeRow<CreatorCanon>(
    supabase
      .schema("creator")
      .from("creator_canon")
      .select(CANON_COLUMNS)
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
}

/** The canon is stale once the corpus has grown meaningfully past the size it was derived from. */
export function isCanonStale(canon: CreatorCanon | null, corpusSize: number): boolean {
  if (!canon) return false
  return corpusSize - canon.corpus_size >= 5
}

export function canonBlocker(canon: CreatorCanon | null, corpusSize: number): CreatorBlocker | null {
  if (!corpusSize) return NO_CORPUS_BLOCKER

  if (!canon) {
    return {
      reason: "no_canon",
      action: "Corpus is in place. Derive your canon to see pillars, formats and voice.",
      href: "/creator/dashboard/canon",
    }
  }

  if (corpusSize < CONFIDENCE_THRESHOLDS.low) {
    return {
      reason: "insufficient_corpus",
      action: `Voice is readable, but pillars and formats need about ${CONFIDENCE_THRESHOLDS.low} posts to mean anything.`,
      href: "/creator/dashboard/content",
    }
  }

  return null
}

export async function loadCanon(
  supabase: SupabaseClient,
  userId: string,
): Promise<CanonContext> {
  const [canon, corpus] = await Promise.all([
    loadCreatorCanon(supabase, userId),
    loadCorpusSummary(supabase, userId),
  ])

  return {
    canon,
    corpus,
    blocker: canonBlocker(canon, corpus.total_posts),
  }
}

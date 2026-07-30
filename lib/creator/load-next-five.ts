import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "./query"
import { loadCreatorCanon } from "./load-canon"
import { loadCorpusSummary } from "./load-corpus"
import {
  NO_CORPUS_BLOCKER,
  type CreatorDraft,
  type NextFiveContext,
} from "./types"

export const NEXT_FIVE_SIZE = 5

const DRAFT_COLUMNS =
  "id,kind,state,autonomy,title,body,rationale,provenance,created_at,decided_at,format_id,pillar_id,hook,estimated_duration_seconds"

/** Undecided drafts only — approved and killed items leave the queue. */
export async function loadCreatorDrafts(
  supabase: SupabaseClient,
  userId: string,
  limit = NEXT_FIVE_SIZE,
): Promise<CreatorDraft[]> {
  return safeRows<CreatorDraft>(
    supabase
      .schema("creator")
      .from("creator_work")
      .select(DRAFT_COLUMNS)
      .eq("user_id", userId)
      .eq("kind", "draft")
      .eq("state", "proposed")
      .order("created_at", { ascending: false })
      .limit(limit),
  )
}

export async function loadNextFive(
  supabase: SupabaseClient,
  userId: string,
): Promise<NextFiveContext> {
  const [drafts, canon, corpus] = await Promise.all([
    loadCreatorDrafts(supabase, userId),
    loadCreatorCanon(supabase, userId),
    loadCorpusSummary(supabase, userId),
  ])

  if (!corpus.total_posts) {
    return { drafts, canon, blocker: NO_CORPUS_BLOCKER }
  }

  if (!canon) {
    return {
      drafts,
      canon,
      blocker: {
        reason: "no_canon",
        action: "Drafts are written against your derived formats and voice. Derive your canon first.",
        href: "/creator/dashboard/canon",
      },
    }
  }

  return { drafts, canon, blocker: null }
}

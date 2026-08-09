import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "./query"
import { loadCreatorCanon } from "./load-canon"
import { loadCorpusSummary } from "./load-corpus"
import {
  NO_CORPUS_BLOCKER,
  type CreatorDraft,
  type DraftSource,
  type NextFiveContext,
} from "./types"

export const NEXT_FIVE_SIZE = 5

const DRAFT_COLUMNS =
  "id,kind,state,autonomy,title,body,premise,script_sections,visual_plan,rationale,counterparty,provenance,created_at,decided_at,format_id,pillar_id,hook,estimated_duration_seconds"

/** Undecided drafts only — approved and killed items leave the queue. */
export async function loadCreatorDrafts(
  supabase: SupabaseClient,
  userId: string,
  limit = NEXT_FIVE_SIZE,
): Promise<CreatorDraft[]> {
  // Without `source`: it is joined afterwards, not selected, and claiming the
  // column exists makes the row type disagree with the query.
  const drafts = await safeRows<DraftRow>(
    supabase
      .schema("creator")
      .from("creator_work")
      .select(DRAFT_COLUMNS)
      .eq("user_id", userId)
      .eq("kind", "draft")
      .eq("state", "proposed")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit),
  )

  return attachSources(supabase, userId, drafts)
}

/**
 * Reattach each draft to the dossier it came from.
 *
 * The link was always in provenance and nothing ever followed it, so a script
 * arrived in the queue stripped of the thesis, the receipts and the lineage
 * that justified writing it. Deciding whether to shoot something means reading
 * the evidence, and the evidence was one screen away with no path back to it.
 *
 * Deleted stories are deliberately still joined. A draft that outlived its
 * story should keep showing where its facts came from; hiding them would leave
 * the creator holding claims with no visible source, which is worse than
 * showing a source they have since binned.
 */
type DraftRow = Omit<CreatorDraft, "source">

async function attachSources(
  supabase: SupabaseClient,
  userId: string,
  drafts: DraftRow[],
): Promise<CreatorDraft[]> {
  const storyIds = [
    ...new Set(
      drafts
        .map((d) => (d.provenance as { story_id?: string } | null)?.story_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (!storyIds.length) return drafts.map((d) => ({ ...d, source: null }))

  type StoryRow = Omit<DraftSource, "story_id"> & { id: string }

  const stories = await safeRows<StoryRow>(
    supabase
      .schema("creator")
      .from("creator_stories")
      .select("id,thesis,why_now,stakes,open_question,primary_emotion,output_format,move,receipts,lineage,lineage_state")
      .eq("user_id", userId)
      .in("id", storyIds),
  )

  const byId = new Map(stories.map((s) => [s.id, s]))

  return drafts.map((draft) => {
    const id = (draft.provenance as { story_id?: string } | null)?.story_id
    const story = id ? byId.get(id) : undefined
    if (!story) return { ...draft, source: null }

    const { id: storyId, ...rest } = story
    return {
      ...draft,
      source: { story_id: storyId, ...rest, receipts: rest.receipts ?? [] },
    }
  })
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

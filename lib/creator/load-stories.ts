import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "./query"
import { loadExtractsForSignals, type CreatorExtract } from "./load-extracts"
import { NO_TRAJECTORY_BLOCKER } from "./types"
import type {
  CreatorBlocker,
  CreatorMove,
  CreatorStory,
  OpportunitiesContext,
  StoriesContext,
} from "./types"
import type { CreatorWorkItem } from "./types"

const STORY_COLUMNS =
  // One literal, never concatenated: PostgREST's typed client parses this string
  // at the type level, and a `+` defeats it and collapses every row to unknown.
  "id,state,thesis,synthesis_kind,move,receipts,why_now,angle,suggested_pillar_id,work_item_id,created_at,lineage,lineage_state,named_actor,stakes,open_question,hook_line,unknowns,kill_reason,primary_emotion,output_format,gate_failure,signal_ids"

const WORK_COLUMNS =
  "id,kind,state,autonomy,title,body,rationale,counterparty,deadline,apply_url,eligibility,provenance,created_at,decided_at"

/** Blocker shared by both agent screens: without topics, nothing hunts. */
export async function researchTopicsBlocker(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreatorBlocker | null> {
  const [{ data: settings }, { data: canon }] = await Promise.all([
    supabase.schema("creator").from("creator_settings").select("niche_topics").eq("user_id", userId).maybeSingle(),
    supabase.schema("creator").from("creator_canon").select("version").eq("user_id", userId)
      .order("version", { ascending: false }).limit(1).maybeSingle(),
  ])

  const hasDeclared = Array.isArray(settings?.niche_topics) && settings.niche_topics.length > 0
  if (hasDeclared || canon) {
    // Having something to search is the hard blocker. Not having said where you
    // are going is a softer one, but it is the difference between a desk that
    // deepens your archive and one that moves you, so it is worth saying.
    const { data: trajectory } = await supabase
      .schema("creator")
      .from("creator_trajectory")
      .select("north_star")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()
    return trajectory?.north_star ? null : NO_TRAJECTORY_BLOCKER
  }

  return {
    reason: "no_topics",
    action: "Your agents need topics to hunt in. Add your niche topics in Settings — they are replaced by your derived canon once your content is ingested.",
    href: "/creator/dashboard/settings",
  }
}

export async function loadStories(supabase: SupabaseClient, userId: string): Promise<StoriesContext> {
  const [stories, blocker] = await Promise.all([
    safeRows<CreatorStory>(
      supabase
        .schema("creator")
        .from("creator_stories")
        .select(STORY_COLUMNS)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .in("state", ["watchlist", "proposed"])
        .order("created_at", { ascending: false })
        .limit(40),
    ),
    researchTopicsBlocker(supabase, userId),
  ])

  // One query for every story's extracts rather than one per story. The screen
  // shows up to forty cards and the alternative is forty round trips.
  const extracts = await loadExtractsForSignals(
    supabase,
    userId,
    [...new Set(stories.flatMap((s) => s.signal_ids ?? []))],
  )

  const withExtracts = stories.map((story) => ({
    ...story,
    extracts: (story.signal_ids ?? [])
      .map((id) => extracts.get(id))
      .filter((e): e is CreatorExtract => Boolean(e?.verified)),
  }))

  return {
    proposed: withExtracts.filter((s) => s.state === "proposed"),
    watchlist: withExtracts.filter((s) => s.state === "watchlist"),
    blocker,
  }
}

export async function loadOpportunities(
  supabase: SupabaseClient,
  userId: string,
): Promise<OpportunitiesContext> {
  const [work, moves, blocker] = await Promise.all([
    safeRows<CreatorWorkItem>(
      supabase
        .schema("creator")
        .from("creator_work")
        .select(WORK_COLUMNS)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .neq("state", "archived")
        .in("kind", ["deal", "event", "grant"])
        // Deadline first, nulls last: what closes soonest is what needs
        // deciding soonest, and a marketplace listing with no date can wait
        // behind a call that shuts on Friday.
        .order("deadline", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(80),
    ),
    safeRows<CreatorMove>(
      supabase
        .schema("creator")
        .from("creator_work")
        .select(`${WORK_COLUMNS},outline,script`)
        .eq("user_id", userId)
        .eq("kind", "move")
        .eq("state", "proposed")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(12),
    ),
    researchTopicsBlocker(supabase, userId),
  ])

  return {
    proposed: work.filter((w) => w.state === "proposed"),
    active: work.filter((w) => w.state === "approved" || w.state === "active"),
    done: work.filter((w) => w.state === "done" || w.state === "killed").slice(0, 20),
    moves,
    blocker,
  }
}

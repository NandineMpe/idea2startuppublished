import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "./query"
import type {
  CreatorBlocker,
  CreatorMove,
  CreatorStory,
  OpportunitiesContext,
  StoriesContext,
} from "./types"
import type { CreatorWorkItem } from "./types"

const STORY_COLUMNS =
  "id,state,thesis,synthesis_kind,receipts,why_now,why_you,angle,suggested_pillar_id,work_item_id,created_at,lineage,lineage_state"

const WORK_COLUMNS =
  "id,kind,state,autonomy,title,body,rationale,provenance,created_at,decided_at"

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
  if (hasDeclared || canon) return null

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
        .in("state", ["watchlist", "proposed"])
        .order("created_at", { ascending: false })
        .limit(40),
    ),
    researchTopicsBlocker(supabase, userId),
  ])

  return {
    proposed: stories.filter((s) => s.state === "proposed"),
    watchlist: stories.filter((s) => s.state === "watchlist"),
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
        .in("kind", ["deal", "event"])
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

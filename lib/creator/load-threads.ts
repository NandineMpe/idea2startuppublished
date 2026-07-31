import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "./query"
import { NO_CORPUS_BLOCKER, type CreatorThread, type ThreadsContext } from "./types"
import { loadCorpusSummary } from "./load-corpus"

const THREAD_COLUMNS =
  "id,subject,query,origin,anchor_date,what_was_known,open_questions,state,developments,last_checked_at,next_check_at,check_count,work_item_id"

export async function loadThreads(
  supabase: SupabaseClient,
  userId: string,
): Promise<ThreadsContext> {
  const [threads, corpus] = await Promise.all([
    safeRows<CreatorThread>(
      supabase
        .schema("creator")
        .from("creator_threads")
        .select(THREAD_COLUMNS)
        .eq("user_id", userId)
        .is("deleted_at", null)
        // Oldest anchor first. A thread from a year ago has had the most time to
        // develop and is the one the rest of the world is least likely to have
        // gone back to, which is exactly where the creator's advantage is.
        .order("anchor_date", { ascending: true })
        .limit(60),
    ),
    loadCorpusSummary(supabase, userId),
  ])

  return {
    moved: threads.filter((t) => t.state === "moved"),
    watching: threads.filter((t) => t.state === "watching"),
    dormant: threads.filter((t) => t.state === "dormant" || t.state === "closed"),
    blocker: corpus.total_posts ? null : NO_CORPUS_BLOCKER,
  }
}

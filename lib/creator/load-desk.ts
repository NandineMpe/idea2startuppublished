import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "./query"
import { loadCreatorCanon } from "./load-canon"
import { loadCorpusSummary } from "./load-corpus"
import {
  NO_CORPUS_BLOCKER,
  type CreatorWorkItem,
  type DeskContext,
} from "./types"

const WORK_COLUMNS =
  "id,kind,state,autonomy,title,body,rationale,provenance,created_at,decided_at"

/** Work touched in the last day — the overnight shift, which is what The Desk reports on. */
const DESK_WINDOW_HOURS = 36

function windowStart(): string {
  return new Date(Date.now() - DESK_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
}

export async function loadRecentWork(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreatorWorkItem[]> {
  return safeRows<CreatorWorkItem>(
    supabase
      .schema("creator")
      .from("creator_work")
      .select(WORK_COLUMNS)
      .eq("user_id", userId)
      .gte("created_at", windowStart())
      .order("created_at", { ascending: false }),
  )
}

export async function loadDesk(supabase: SupabaseClient, userId: string): Promise<DeskContext> {
  const [work, canon, corpus] = await Promise.all([
    loadRecentWork(supabase, userId),
    loadCreatorCanon(supabase, userId),
    loadCorpusSummary(supabase, userId),
  ])

  // Autonomy decides which pile an item lands in: auto reports, approve waits, escalate interrupts.
  const escalations = work.filter((item) => item.autonomy === "escalate" && item.state === "proposed")
  const awaiting = work.filter((item) => item.autonomy === "approve" && item.state === "proposed")
  const completed = work.filter((item) => item.autonomy === "auto" || item.state !== "proposed")

  const lastRunAt = work.at(0)?.created_at ?? null

  return {
    corpus,
    canon,
    completed,
    awaiting,
    escalations,
    last_run_at: lastRunAt,
    blocker: corpus.total_posts ? null : NO_CORPUS_BLOCKER,
  }
}

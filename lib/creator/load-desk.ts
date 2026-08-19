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
  "id,kind,state,autonomy,title,body,rationale,counterparty,deadline,apply_url,eligibility,provenance,created_at,decided_at"

/**
 * How wide a spread of timestamps still counts as one run.
 *
 * Not "the last 36 hours". The agents run on request now, so a wall-clock
 * window is a promise the schedule used to keep and no longer does: a creator
 * who sweeps every ten days would open the Desk to an empty page for eight of
 * them, having done nothing wrong. The window is anchored to the newest item
 * instead, so it always frames the last run whenever that was, and it is wide
 * enough to hold the fan-out of one sweep, which lands over minutes to hours as
 * synthesis and the writer finish behind it.
 */
const RUN_SPREAD_HOURS = 36

/** Enough to hold a long backlog without unbounding the query. */
const MAX_WORK_ROWS = 300

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
      .is("deleted_at", null)
      .neq("state", "archived")
      .order("created_at", { ascending: false })
      .limit(MAX_WORK_ROWS),
  )
}

export async function loadDesk(supabase: SupabaseClient, userId: string): Promise<DeskContext> {
  const [work, canon, corpus] = await Promise.all([
    loadRecentWork(supabase, userId),
    loadCreatorCanon(supabase, userId),
    loadCorpusSummary(supabase, userId),
  ])

  // Autonomy decides which pile an item lands in: auto reports, approve waits, escalate interrupts.
  //
  // Nothing still proposed is ever aged out. It is a queue, not a bulletin: an
  // approval that expires quietly because nobody logged in for a week is a
  // decision made by a timer, and the whole point of the two top sections is
  // that they are decisions she makes.
  const escalations = work.filter((item) => item.autonomy === "escalate" && item.state === "proposed")
  const awaiting = work.filter((item) => item.autonomy === "approve" && item.state === "proposed")

  // The report, on the other hand, is about one run, so it is windowed. The
  // anchor is the newest finished item rather than now.
  const finished = work.filter((item) => item.autonomy === "auto" || item.state !== "proposed")
  const anchor = finished.at(0)?.created_at
  const completed = anchor
    ? finished.filter(
        (item) =>
          new Date(anchor).getTime() - new Date(item.created_at).getTime() <=
          RUN_SPREAD_HOURS * 60 * 60 * 1000,
      )
    : []

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

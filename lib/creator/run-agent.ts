"use server"

import { revalidatePath } from "next/cache"
import { requireCreatorUser } from "./auth"
import { sendCreatorEvent } from "./inngest/client"

/**
 * Agent triggers. Every run in the product starts here.
 *
 * These used to be the manual override on top of a set of crons that swept
 * every morning. The schedules are gone: the creator does not work here daily,
 * and a desk that files a fresh slate each morning to someone who visits
 * fortnightly is not diligence, it is thirteen stale runs buried on top of the
 * one she would have read. Everything now runs when it is asked to, which also
 * means the corpus is freshest at the moment she is actually looking at it.
 *
 * The Inngest functions still accept the same events they always did, so this
 * is one code path rather than a parallel "manual mode" that can drift, and
 * putting a schedule back is a one-line change in the function that wants it.
 */

export type AgentKind = "research" | "opportunities" | "canon" | "metrics" | "writer" | "everything"

export type LineageActionResult = { ok: true } | { ok: false; error: string }

/** Ask for a story's historical spine. Separate from runCreatorAgent because it targets one story. */
export async function deriveStoryLineage(storyId: string): Promise<LineageActionResult> {
  const { supabase, userId } = await requireCreatorUser()

  const { error: markError } = await supabase
    .schema("creator")
    .from("creator_stories")
    .update({ lineage_state: "running" })
    .eq("id", storyId)
    .eq("user_id", userId)
  if (markError) return { ok: false, error: markError.message }

  try {
    await sendCreatorEvent({ name: "creator/story.lineage", data: { user_id: userId, story_id: storyId } })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach the agent runner." }
  }

  revalidatePath("/creator/dashboard/stories")
  return { ok: true }
}

export type RunAgentResult = { ok: true; message: string } | { ok: false; error: string }

const AGENTS_NEEDING_TOPICS: AgentKind[] = ["research", "opportunities", "everything"]

/** Never reach back less than this, so a second press the same day still finds things. */
const MIN_LOOKBACK_HOURS = 72
/** Beyond a month the sources get slow and the run is a rebuild, not a catch-up. */
const MAX_LOOKBACK_HOURS = 720

/**
 * How far back this sweep should read, derived from when the last one ran.
 *
 * A fixed 72 hours was right when the sweep ran every morning and only ever had
 * one day to cover. Asked for by hand after a fortnight away it would search
 * the last three days and report a quiet fortnight, which is the most damaging
 * thing this system can do: it looks like an answer. The gap decides the
 * window instead.
 */
async function lookbackHours(
  supabase: Awaited<ReturnType<typeof requireCreatorUser>>["supabase"],
  userId: string,
): Promise<number> {
  const { data } = await supabase
    .schema("creator")
    .from("creator_signals")
    .select("ingested_at")
    .eq("user_id", userId)
    .order("ingested_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.ingested_at) return MAX_LOOKBACK_HOURS
  const hours = (Date.now() - new Date(data.ingested_at as string).getTime()) / 3_600_000
  // A margin on top of the gap: a source that publishes with a lag would
  // otherwise fall in the seam between two runs and never be seen by either.
  return Math.min(MAX_LOOKBACK_HOURS, Math.max(MIN_LOOKBACK_HOURS, Math.ceil(hours * 1.25)))
}

export async function runCreatorAgent(
  kind: AgentKind,
  brief?: string,
): Promise<RunAgentResult> {
  const { supabase, userId } = await requireCreatorUser()

  // Hunting agents resolve their subject from topics. Without them the run is a
  // silent no-op, which reads as a broken button — so refuse and say why.
  if (AGENTS_NEEDING_TOPICS.includes(kind)) {
    const [{ data: settings }, { data: canon }] = await Promise.all([
      supabase.schema("creator").from("creator_settings").select("niche_topics").eq("user_id", userId).maybeSingle(),
      supabase.schema("creator").from("creator_canon").select("topics").eq("user_id", userId)
        .order("version", { ascending: false }).limit(1).maybeSingle(),
    ])
    const declared = Array.isArray(settings?.niche_topics) ? settings.niche_topics.length : 0
    const derived = Array.isArray(canon?.topics) ? canon.topics.length : 0
    if (!declared && !derived) {
      return {
        ok: false,
        error: "Add niche topics in Settings first — the hunting agents have nothing to search on without them.",
      }
    }
  }

  try {
    switch (kind) {
      case "research":
        await sendCreatorEvent({
          name: "creator/research.sweep",
          data: { user_id: userId, hours_back: await lookbackHours(supabase, userId) },
        })
        break
      case "opportunities":
        await sendCreatorEvent({ name: "creator/opportunities.sweep", data: { user_id: userId } })
        break
      case "canon":
        await sendCreatorEvent({ name: "creator/canon.derive", data: { user_id: userId } })
        break
      case "metrics":
        await sendCreatorEvent({ name: "creator/metrics.refresh", data: { user_id: userId } })
        break
      case "writer":
        await sendCreatorEvent({
          name: "creator/writer.draft",
          data: { user_id: userId, brief: brief?.trim() || undefined },
        })
        break
      // The one button for someone coming back after two weeks away. The
      // writer is deliberately not in it: it drafts off the slate, and the
      // slate is what these four are about to replace.
      case "everything":
        await sendCreatorEvent({
          name: "creator/research.sweep",
          data: { user_id: userId, hours_back: await lookbackHours(supabase, userId) },
        })
        await sendCreatorEvent({ name: "creator/opportunities.sweep", data: { user_id: userId } })
        // A bigger batch than the old four-a-day: the threads that came due
        // while nobody was here should all be looked at, not four of them.
        await sendCreatorEvent({ name: "creator/threads.check", data: { user_id: userId, limit: 12 } })
        await sendCreatorEvent({ name: "creator/metrics.refresh", data: { user_id: userId } })
        break
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach the agent runner." }
  }

  // Agents are queued, not awaited: the work happens on Inngest and lands on the
  // Desk when it is done, so the copy promises a queue rather than a result.
  const messages: Record<AgentKind, string> = {
    research: "Researcher queued. It reads back to your last sweep, so dossiers land on Stories in a few minutes.",
    opportunities: "Partnerships desk queued. Results land on Opportunities.",
    canon: "Canon re-derivation queued.",
    metrics: "Metrics refresh queued. View counts update as it walks your corpus.",
    writer: "Writer queued. The draft lands in Next Five.",
    everything:
      "All four queued: research, deals, open files, metrics. Give it fifteen minutes or so, then reload. Nothing needs you until it lands.",
  }

  for (const p of ["", "/stories", "/opportunities", "/next", "/canon", "/content"]) {
    revalidatePath(`/creator/dashboard${p}`)
  }

  return { ok: true, message: messages[kind] }
}

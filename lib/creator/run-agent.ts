"use server"

import { revalidatePath } from "next/cache"
import { requireCreatorUser } from "./auth"
import { sendCreatorEvent } from "./inngest/client"

/**
 * Manual agent triggers.
 *
 * The crons are the product — agents that work while you sleep — but waiting
 * until 06:00 to find out whether a change worked is a poor way to build or to
 * recover from a bad run. These fire the same events the schedule does, so
 * there is one code path rather than a parallel "manual mode" that can drift.
 */

export type AgentKind = "research" | "opportunities" | "canon" | "metrics" | "writer"

export type RunAgentResult = { ok: true; message: string } | { ok: false; error: string }

const AGENTS_NEEDING_TOPICS: AgentKind[] = ["research", "opportunities"]

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
        await sendCreatorEvent({ name: "creator/research.sweep", data: { user_id: userId, hours_back: 72 } })
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
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach the agent runner." }
  }

  // Agents are queued, not awaited: the work happens on Inngest and lands on the
  // Desk when it is done, so the copy promises a queue rather than a result.
  const messages: Record<AgentKind, string> = {
    research: "Researcher queued — dossiers land on Stories in a few minutes.",
    opportunities: "Partnerships desk queued — results land on Opportunities.",
    canon: "Canon re-derivation queued.",
    metrics: "Metrics refresh queued — view counts update as it walks your corpus.",
    writer: "Writer queued — the draft lands in Next Five.",
  }

  for (const p of ["", "/stories", "/opportunities", "/next", "/canon", "/content"]) {
    revalidatePath(`/creator/dashboard${p}`)
  }

  return { ok: true, message: messages[kind] }
}

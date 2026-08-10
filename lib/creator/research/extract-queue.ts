import type { SupabaseClient } from "@supabase/supabase-js"
import { extractSignal, type ExtractResult } from "./extract"

/**
 * Which documents actually get read.
 *
 * The spec put extraction between the sweep and synthesis, and that ordering is
 * right about intent and wrong about arithmetic. The gate is evaluated during
 * synthesis, because it needs a thesis to judge, so "run extraction only on
 * candidates that clear the gate" cannot happen before synthesis exists.
 *
 * The cost settles it. A morning sweep puts roughly 200 signals in front of the
 * researcher, and a real document runs about 46,000 input tokens once fetched
 * in full. Extracting everything considered would be around 9,000,000 tokens a
 * day to produce two stories. Extracting the sources a passing story actually
 * cites is six to eight documents, roughly 300,000 tokens, for the same result
 * on the only cards the creator will ever see.
 *
 * So extraction runs immediately after synthesis, over the receipts of stories
 * that passed the gate, and upgrades those receipts from a search-result
 * snippet to a verified quote out of the document itself.
 */

const MAX_DOCUMENTS_PER_RUN = 8

export type ExtractQueueResult = {
  attempted: number
  verified: number
  cached: number
  failed: number
  results: ExtractResult[]
}

/**
 * Signals cited by stories that passed the gate and are awaiting a decision.
 *
 * Deliberately not "signals from today's sweep". A story is the unit that
 * earned the read: it survived the candidate gate and the evidence gate, and
 * its receipts are the exact documents the creator will be asked to stand
 * behind on camera.
 */
export async function pendingExtractionTargets(
  supabase: SupabaseClient,
  userId: string,
  sinceHours = 36,
): Promise<Array<{ id: string; url: string | null; title: string }>> {
  const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString()

  const { data: stories } = await supabase
    .schema("creator")
    .from("creator_stories")
    .select("signal_ids")
    .eq("user_id", userId)
    .eq("state", "proposed")
    .is("deleted_at", null)
    .gte("created_at", since)

  const signalIds = [
    ...new Set(
      (stories ?? []).flatMap((s) => ((s.signal_ids as string[] | null) ?? [])),
    ),
  ]
  if (!signalIds.length) return []

  // extracted_at null only: a document already read stays read, and the
  // content-hash cache inside extractSignal covers the case where it changed.
  const { data: signals } = await supabase
    .schema("creator")
    .from("creator_signals")
    .select("id,url,title")
    .eq("user_id", userId)
    .in("id", signalIds)
    .is("extracted_at", null)
    .not("url", "is", null)
    .limit(MAX_DOCUMENTS_PER_RUN)

  return (signals ?? []) as Array<{ id: string; url: string | null; title: string }>
}

export async function runExtractionQueue(
  supabase: SupabaseClient,
  userId: string,
): Promise<ExtractQueueResult> {
  const targets = await pendingExtractionTargets(supabase, userId)
  const out: ExtractQueueResult = {
    attempted: targets.length,
    verified: 0,
    cached: 0,
    failed: 0,
    results: [],
  }

  for (const target of targets) {
    // One document's failure is not the run's failure. A regulator behind a
    // JS-only portal should cost that receipt its quote, not cost the other
    // seven documents their read.
    let result: ExtractResult
    try {
      result = await extractSignal(supabase, userId, target)
    } catch (e) {
      result = { ok: false, signalId: target.id, error: e instanceof Error ? e.message : String(e) }
    }
    out.results.push(result)
    if (!result.ok) out.failed++
    else if (result.cached) out.cached++
    else if (result.verified) out.verified++
    else out.failed++
  }

  return out
}

/**
 * Shared Layer-3 lookalike feedback: insert outcome row, update stats, optional AI refine.
 */

import { getCompanyContext } from "@/lib/company-context"
import { refineLookalikeProfileWithAI } from "@/lib/lookalike/ai-profile"
import { normalizeDimensions, normalizeOutreachPlaybook, normalizeStats } from "@/lib/lookalike/normalize"
import { applyOutcomeToStats } from "@/lib/lookalike/stats"
import { supabaseAdmin } from "@/lib/supabase"
import type { LookalikeStats, OutreachOutcomeType } from "@/types/lookalike"

export type RecordLookalikeOutcomeParams = {
  userId: string
  profileId: string
  outcome: OutreachOutcomeType
  actualAttributes?: Record<string, string>
  channel?: string | null
  notes?: string | null
}

export type RecordLookalikeOutcomeResult = {
  stats: LookalikeStats
  outcomesTotal: number
  refined: boolean
  refinementNote?: string
}

/**
 * Persists to `lookalike_outreach_outcomes`, bumps `lookalike_profiles.stats`,
 * and runs AI refinement every 5 new outcomes (same rules as the REST route).
 */
export async function recordLookalikeOutreachOutcome(
  params: RecordLookalikeOutcomeParams,
): Promise<RecordLookalikeOutcomeResult> {
  const { userId, profileId, outcome, actualAttributes = {}, channel, notes } = params

  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from("lookalike_profiles")
    .select("*")
    .eq("id", profileId)
    .eq("user_id", userId)
    .maybeSingle()

  if (fetchErr || !profile) {
    throw new Error("Profile not found")
  }

  const { error: insErr } = await supabaseAdmin.from("lookalike_outreach_outcomes").insert({
    user_id: userId,
    profile_id: profileId,
    outcome,
    actual_attributes: actualAttributes,
    channel: channel ?? null,
    notes: notes ?? null,
  })

  if (insErr) {
    throw new Error(insErr.message)
  }

  let stats = normalizeStats(profile.stats)
  stats = applyOutcomeToStats(stats, outcome)

  await supabaseAdmin
    .from("lookalike_profiles")
    .update({ stats, updated_at: new Date().toISOString() })
    .eq("id", profileId)

  const { count: outcomeCount } = await supabaseAdmin
    .from("lookalike_outreach_outcomes")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profileId)

  const total = outcomeCount ?? 0
  const lastRef = stats.outcomeCountAtLastRefine ?? 0
  let refined = false
  let refinementNote: string | undefined

  if (total >= lastRef + 5) {
    const context = await getCompanyContext(userId, { queryHint: "lookalike profile refinement" })
    if (context) {
      const { data: recent } = await supabaseAdmin
        .from("lookalike_outreach_outcomes")
        .select("outcome, actual_attributes, channel, notes")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(40)

      const refinedResult = await refineLookalikeProfileWithAI({
        context,
        profileName: profile.name,
        dimensions: normalizeDimensions(profile.dimensions),
        outreachPlaybook: normalizeOutreachPlaybook(profile.outreach_playbook),
        stats,
        outcomes: (recent ?? []).map((r) => ({
          outcome: String(r.outcome),
          actualAttributes: (r.actual_attributes as Record<string, string>) ?? {},
          channel: r.channel,
          notes: r.notes,
        })),
      })

      stats = { ...stats, outcomeCountAtLastRefine: total }
      await supabaseAdmin
        .from("lookalike_profiles")
        .update({
          dimensions: refinedResult.dimensions,
          outreach_playbook: refinedResult.outreachPlaybook,
          stats,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId)

      refined = true
      refinementNote = refinedResult.explanation
    }
  }

  return { stats, outcomesTotal: total, refined, refinementNote }
}

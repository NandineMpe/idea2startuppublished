import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"
import { getCompanyContext } from "@/lib/company-context"
import { normalizeDimensions, normalizeOutreachPlaybook, normalizeStats } from "@/lib/lookalike/normalize"
import { refineLookalikeProfileWithAI } from "@/lib/lookalike/ai-profile"

export const maxDuration = 120

async function resolveUserId(req: NextRequest): Promise<{ userId: string } | { error: NextResponse }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { userId: user.id }
}

/**
 * POST /api/lookalike-profiles/[id]/refine — manual refinement from stored outcomes.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolveUserId(req)
  if ("error" in auth) return auth.error

  const { id: profileId } = await ctx.params
  if (!profileId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from("lookalike_profiles")
    .select("*")
    .eq("id", profileId)
    .eq("user_id", auth.userId)
    .maybeSingle()

  if (fetchErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  const context = await getCompanyContext(auth.userId, { queryHint: "lookalike profile refinement" })
  if (!context) {
    return NextResponse.json({ error: "No company profile" }, { status: 400 })
  }

  const { data: recent } = await supabaseAdmin
    .from("lookalike_outreach_outcomes")
    .select("outcome, actual_attributes, channel, notes")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(60)

  const stats = normalizeStats(profile.stats)
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

  const { count } = await supabaseAdmin
    .from("lookalike_outreach_outcomes")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profileId)

  const nextStats = { ...stats, outcomeCountAtLastRefine: count ?? stats.outcomeCountAtLastRefine }

  await supabaseAdmin
    .from("lookalike_profiles")
    .update({
      dimensions: refinedResult.dimensions,
      outreach_playbook: refinedResult.outreachPlaybook,
      stats: nextStats,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)

  return NextResponse.json({
    ok: true,
    explanation: refinedResult.explanation,
    dimensions: refinedResult.dimensions,
    outreachPlaybook: refinedResult.outreachPlaybook,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { recordLookalikeOutreachOutcome } from "@/lib/lookalike/record-outreach-outcome"
import type { OutreachOutcomeType } from "@/types/lookalike"

export const maxDuration = 120

const OUTCOMES: OutreachOutcomeType[] = [
  "contacted",
  "no_response",
  "replied",
  "meeting",
  "closed_won",
  "closed_lost",
  "not_icp",
]

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
 * POST /api/lookalike-profiles/[id]/outcome — Layer 3 feedback loop.
 * Body: { outcome, actualAttributes?, channel?, notes? }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolveUserId(req)
  if ("error" in auth) return auth.error

  const { id: profileId } = await ctx.params
  if (!profileId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const outcome = String(body.outcome ?? "").trim() as OutreachOutcomeType
  if (!OUTCOMES.includes(outcome)) {
    return NextResponse.json({ error: "invalid outcome" }, { status: 400 })
  }

  const actualAttributes =
    body.actualAttributes && typeof body.actualAttributes === "object"
      ? (body.actualAttributes as Record<string, string>)
      : {}
  const channel = typeof body.channel === "string" ? body.channel.trim() : null
  const notes = typeof body.notes === "string" ? body.notes.trim() : null

  try {
    const result = await recordLookalikeOutreachOutcome({
      userId: auth.userId,
      profileId,
      outcome,
      actualAttributes,
      channel,
      notes,
    })

    return NextResponse.json({
      ok: true,
      stats: result.stats,
      outcomesTotal: result.outcomesTotal,
      refined: result.refined,
      refinementNote: result.refinementNote,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed"
    const status = msg === "Profile not found" ? 404 : 500
    if (status === 500) {
      return jsonApiError(500, e, "lookalike-profiles outcome POST")
    }
    return NextResponse.json({ error: msg }, { status })
  }
}

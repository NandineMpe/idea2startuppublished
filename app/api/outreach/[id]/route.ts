import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendOutreachEmailForUser } from "@/lib/juno/outreach-send-ops"
import { recordLookalikeOutreachOutcome } from "@/lib/lookalike/record-outreach-outcome"
import type { OutreachOutcomeType } from "@/types/lookalike"

export const maxDuration = 60

const LOOKALIKE_OUTCOMES: OutreachOutcomeType[] = [
  "contacted",
  "no_response",
  "replied",
  "meeting",
  "closed_won",
  "closed_lost",
  "not_icp",
]

type PatchBody = {
  subject?: string
  body?: string
  status?: string
  outcome?: string | null
  outcome_notes?: string | null
  scheduled_for?: string | null
  skipped_reason?: string | null
  /** When true with `lookalike_outcome`, syncs to `lookalike_outreach_outcomes` + profile stats. */
  sync_lookalike?: boolean
  lookalike_outcome?: OutreachOutcomeType
  /** Override profile when the outreach row has no `lookalike_profile_id`. */
  lookalike_profile_id?: string
  /** Set status to `sent` with `sent_at` now — use when you emailed from your own client (no Resend). */
  mark_sent_manually?: boolean
}

async function resolveUser(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { userId: user.id, supabase }
}

type PostBody = {
  action?: string
}

/**
 * POST /api/outreach/[id] — `{ "action": "send" }` sends via Resend (same as POST /api/outreach/send).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolveUser(req)
  if ("error" in auth) return auth.error

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body.action !== "send") {
    return NextResponse.json({ error: 'Expected { "action": "send" }' }, { status: 400 })
  }

  const result = await sendOutreachEmailForUser(auth.supabase, auth.userId, id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true, messageId: result.messageId })
}

/**
 * PATCH /api/outreach/[id] — edit draft, skip, reschedule, record outcome.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolveUser(req)
  if ("error" in auth) return auth.error

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  let patch: PatchBody
  try {
    patch = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { data: existing } = await auth.supabase
    .from("outreach_log")
    .select("id, lookalike_profile_id, to_company, to_title, lead_id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let syncProfileId: string | null = null
  if (patch.sync_lookalike && patch.lookalike_outcome) {
    const lo = patch.lookalike_outcome
    if (!LOOKALIKE_OUTCOMES.includes(lo)) {
      return NextResponse.json({ error: "invalid lookalike_outcome" }, { status: 400 })
    }
    syncProfileId =
      (typeof patch.lookalike_profile_id === "string" && patch.lookalike_profile_id.trim()) ||
      existing.lookalike_profile_id ||
      null
    if (!syncProfileId) {
      return NextResponse.json(
        { error: "lookalike_profile_id required (or set on outreach row when drafted)" },
        { status: 400 },
      )
    }
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (typeof patch.subject === "string") updates.subject = patch.subject
  if (typeof patch.body === "string") updates.body = patch.body
  if (typeof patch.status === "string") updates.status = patch.status
  if (patch.outcome !== undefined) updates.outcome = patch.outcome
  if (patch.outcome_notes !== undefined) updates.outcome_notes = patch.outcome_notes
  if (patch.scheduled_for !== undefined) {
    updates.scheduled_for = patch.scheduled_for ? new Date(patch.scheduled_for).toISOString() : null
  }
  if (patch.skipped_reason !== undefined) updates.skipped_reason = patch.skipped_reason

  if (patch.status === "skipped") {
    updates.status = "skipped"
  }

  if (patch.sync_lookalike && patch.lookalike_outcome) {
    updates.outcome = patch.lookalike_outcome
    if (patch.outcome_notes !== undefined) updates.outcome_notes = patch.outcome_notes
  }

  if (patch.mark_sent_manually === true) {
    updates.status = "sent"
    updates.sent_at = new Date().toISOString()
  }

  const { data, error } = await auth.supabase
    .from("outreach_log")
    .update(updates)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let lookalike: {
    stats: unknown
    outcomesTotal: number
    refined: boolean
    refinementNote?: string
  } | null = null

  if (patch.sync_lookalike && patch.lookalike_outcome && syncProfileId) {
    const lo = patch.lookalike_outcome
    try {
      const result = await recordLookalikeOutreachOutcome({
        userId: auth.userId,
        profileId: syncProfileId,
        outcome: lo,
        channel: "cold_email",
        notes: patch.outcome_notes ?? null,
        actualAttributes: {
          title: existing.to_title ?? "",
          company: existing.to_company ?? "",
          source: "gtm_motion_outreach",
          outreach_log_id: id,
        },
      })
      lookalike = {
        stats: result.stats,
        outcomesTotal: result.outcomesTotal,
        refined: result.refined,
        refinementNote: result.refinementNote,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "lookalike sync failed"
      return NextResponse.json({ error: msg, ok: false }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, lookalike })
}

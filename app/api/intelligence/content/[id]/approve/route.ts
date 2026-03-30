import { NextResponse } from "next/server"
import { INTERNAL_ERROR_MESSAGE, isProduction, jsonApiError, logApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"
import { inngest } from "@/lib/inngest/client"
import {
  buildDismissalReasonText,
  DISMISS_PRESET_IDS,
} from "@/lib/content-preferences"

async function getRow(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data, error } = await supabase
    .from("ai_outputs")
    .select("id, tool, inputs, output, user_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single()
  if (error || !data) return null
  return data
}

function normalizePreset(p: string | undefined): string | null {
  if (!p?.trim()) return null
  const v = p.trim()
  if ((DISMISS_PRESET_IDS as readonly string[]).includes(v)) return v
  return null
}

// POST /api/intelligence/content/[id]/approve
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const row = await getRow(supabase, id, user.id)
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const prevInputs = (row.inputs as Record<string, unknown> | null) ?? {}
    const { error } = await supabase
      .from("ai_outputs")
      .update({ inputs: { ...prevInputs, status: "approved" } })
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) throw error

    await supabase
      .from("content_calendar")
      .update({ status: "approved" })
      .eq("source_ref", id)
      .eq("user_id", user.id)

    const platform =
      typeof prevInputs.platform === "string" ? prevInputs.platform : undefined
    const contentType =
      typeof prevInputs.contentType === "string" ? prevInputs.contentType : undefined

    // Emit event so platformPoster can pick up technical content
    if (row.tool === "content_technical" || platform === "technical") {
      await inngest.send({
        name: "juno/content.approved",
        data: {
          userId: user.id,
          contentId: id,
          platform: platform ?? "technical",
          type: contentType ?? "post_suggestion",
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return jsonApiError(500, err, "content approve POST")
  }
}

// DELETE /api/intelligence/content/[id]/approve  → dismiss (body: reasonPreset?, reasonDetail?)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const row = await getRow(supabase, id, user.id)
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    let body: { reasonPreset?: string; reasonDetail?: string } = {}
    try {
      const t = await req.text()
      if (t) body = JSON.parse(t) as typeof body
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const presetRaw = typeof body.reasonPreset === "string" ? body.reasonPreset : ""
    const detail = typeof body.reasonDetail === "string" ? body.reasonDetail.trim() : ""
    const normalizedPreset = normalizePreset(presetRaw)

    if (presetRaw.trim() && !normalizedPreset) {
      return NextResponse.json({ error: "Invalid reasonPreset" }, { status: 400 })
    }

    if (!normalizedPreset && !detail) {
      return NextResponse.json(
        { error: "Choose a reason or add a note in your own words" },
        { status: 400 },
      )
    }

    const reasonText = buildDismissalReasonText(normalizedPreset, detail || undefined)

    const { data: calRow } = await supabase
      .from("content_calendar")
      .select("id")
      .eq("source_ref", id)
      .eq("user_id", user.id)
      .maybeSingle()

    const prevInputs = (row.inputs as Record<string, unknown> | null) ?? {}
    const { error } = await supabase
      .from("ai_outputs")
      .update({ inputs: { ...prevInputs, status: "dismissed" } })
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) throw error

    // Mark calendar row skipped (dismissal_reason column requires migration 016 — fallback if missing)
    const calWithReason = await supabase
      .from("content_calendar")
      .update({
        status: "skipped",
        dismissal_reason: reasonText,
      })
      .eq("source_ref", id)
      .eq("user_id", user.id)

    if (calWithReason.error) {
      const msg = calWithReason.error.message ?? ""
      const missingCol =
        /dismissal_reason|42703|column .* does not exist/i.test(msg) || calWithReason.error.code === "42703"
      if (missingCol) {
        const { error: calFallback } = await supabase
          .from("content_calendar")
          .update({ status: "skipped" })
          .eq("source_ref", id)
          .eq("user_id", user.id)
        if (calFallback) {
          console.error("content_calendar update (fallback):", calFallback.message)
          throw calFallback
        }
      } else {
        console.error("content_calendar update:", msg)
        throw calWithReason.error
      }
    }

    const preferenceType = normalizedPreset ?? "custom"

    const prefPayload = {
      user_id: user.id,
      content_calendar_id: calRow?.id ?? null,
      ai_output_id: id,
      /** Some Supabase projects use `preference` (legacy) and/or `preference_type` — set both. */
      preference: preferenceType,
      preference_type: preferenceType,
      reason_preset: normalizedPreset,
      reason_detail: detail || null,
      reason_text: reasonText,
    }

    let prefErr = (await supabase.from("content_preferences").insert(prefPayload)).error

    // RLS or policy gaps: retry with service role (still scoped to this user's id)
    if (prefErr && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      prefErr = (await supabaseAdmin.from("content_preferences").insert(prefPayload)).error
    }

    if (prefErr) {
      logApiError("content_preferences insert", prefErr)
      const hint =
        "Could not save dismissal. Apply Supabase migrations 016–017 (content_preferences + dismissal_reason)."
      return NextResponse.json(
        { error: isProduction() ? INTERNAL_ERROR_MESSAGE : prefErr.message || hint },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return jsonApiError(500, err, "content approve DELETE")
  }
}

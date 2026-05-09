import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { appendCareerOsMarkdownToJunoBrain } from "@/lib/careeros/brain/append-llm-to-brain"
import { loadLatestLlmMarkdownPlainText } from "@/lib/careeros/documents/load-latest-llm"
import { mergeCareerOsOnboardingState } from "@/lib/careeros/onboarding/user-settings"
import { supabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      currentRoleTitle?: unknown
      targetRoleTitle?: unknown
      locationLabel?: unknown
      yearsExperience?: unknown
      mergeLlmToBrain?: unknown
    }

    const currentRoleTitle =
      typeof body.currentRoleTitle === "string" ? body.currentRoleTitle.trim() : ""
    const targetRoleTitle =
      typeof body.targetRoleTitle === "string" ? body.targetRoleTitle.trim() : ""
    const locationLabel =
      typeof body.locationLabel === "string" ? body.locationLabel.trim() : ""

    let yearsExperience: number | null = null
    if (body.yearsExperience !== undefined && body.yearsExperience !== null) {
      const n = Number(body.yearsExperience)
      if (!Number.isFinite(n) || n < 0 || n > 80) {
        return NextResponse.json({ error: "Years of experience must be between 0 and 80" }, { status: 400 })
      }
      yearsExperience = Math.round(n * 10) / 10
    }

    if (!currentRoleTitle || !locationLabel) {
      return NextResponse.json(
        { error: "Current role and location are required." },
        { status: 400 },
      )
    }

    const mergeLlmToBrain = body.mergeLlmToBrain === true

    const now = new Date().toISOString()

    const { error: profileError } = await supabaseAdmin
      .schema("careeros")
      .from("user_profiles")
      .upsert(
        {
          user_id: user.id,
          current_role_title: currentRoleTitle,
          target_role_title: targetRoleTitle || null,
          location_label: locationLabel,
          years_experience: yearsExperience,
          updated_at: now,
        },
        { onConflict: "user_id" },
      )

    if (profileError) throw profileError

    let brain:
      | { merged: false; reason?: string }
      | { merged: true; scope: "workspace" | "owner" } = { merged: false }

    if (mergeLlmToBrain) {
      const md = await loadLatestLlmMarkdownPlainText(user.id)
      if (!md) {
        brain = { merged: false, reason: "no_llm_markdown" }
      } else {
        const append = await appendCareerOsMarkdownToJunoBrain(user.id, md)
        if (!append.ok) {
          brain =
            append.reason === "no_scope"
              ? { merged: false, reason: "no_brain_scope" }
              : { merged: false, reason: append.reason }
        } else {
          brain = { merged: true, scope: append.scope }
        }
      }
    }

    await mergeCareerOsOnboardingState(user.id, {
      step3CompletedAt: now,
      module_1_1_complete: true,
    })

    return NextResponse.json({
      ok: true,
      profile: {
        currentRoleTitle,
        targetRoleTitle: targetRoleTitle || null,
        locationLabel,
        yearsExperience,
      },
      ...(mergeLlmToBrain ? { brain } : {}),
    })
  } catch (error) {
    return jsonApiError(500, error, "careeros onboarding step-three")
  }
}

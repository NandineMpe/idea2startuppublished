import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { appendCareerOsMarkdownToJunoBrain } from "@/lib/careeros/brain/append-llm-to-brain"
import { loadLatestLlmMarkdownPlainText } from "@/lib/careeros/documents/load-latest-llm"
import { sendCareerOSEvent } from "@/lib/careeros/inngest/client"
import { mergeCareerOsOnboardingState } from "@/lib/careeros/onboarding/user-settings"
import { upsertCareerOsUserProfile } from "@/lib/careeros/onboarding/upsert-user-profile"
import { matchUserRegionToDemandRegion } from "@/lib/careeros/market/demand-regions"
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
      currentSalaryUsd?: unknown
      learningHoursPerWeek?: unknown
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

    let currentSalaryUsd: number | null = null
    if (body.currentSalaryUsd !== undefined && body.currentSalaryUsd !== null && body.currentSalaryUsd !== "") {
      const n = Number(body.currentSalaryUsd)
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
        return NextResponse.json(
          { error: "Current salary (USD) must be between 0 and 10,000,000" },
          { status: 400 },
        )
      }
      currentSalaryUsd = Math.round(n * 100) / 100
    }

    let learningHoursPerWeek: number | null = null
    if (
      body.learningHoursPerWeek !== undefined &&
      body.learningHoursPerWeek !== null &&
      body.learningHoursPerWeek !== ""
    ) {
      const n = Number(body.learningHoursPerWeek)
      if (!Number.isFinite(n) || n < 1 || n > 40) {
        return NextResponse.json(
          { error: "Learning hours per week must be between 1 and 40" },
          { status: 400 },
        )
      }
      learningHoursPerWeek = Math.round(n)
    }

    if (!currentRoleTitle || !locationLabel) {
      return NextResponse.json(
        { error: "Current role and location are required." },
        { status: 400 },
      )
    }

    const mergeLlmToBrain = body.mergeLlmToBrain === true
    const now = new Date().toISOString()
    const locationRegionCode = matchUserRegionToDemandRegion(locationLabel)

    // Prefer the signed-in client (RLS) so profile save works even if service_role grants lag.
    let profileResult = await upsertCareerOsUserProfile(supabase, {
      userId: user.id,
      currentRoleTitle,
      targetRoleTitle: targetRoleTitle || null,
      locationLabel,
      locationRegionCode,
      yearsExperience,
      currentSalaryUsd,
      updatedAt: now,
    })

    if (!profileResult.ok) {
      profileResult = await upsertCareerOsUserProfile(supabaseAdmin, {
        userId: user.id,
        currentRoleTitle,
        targetRoleTitle: targetRoleTitle || null,
        locationLabel,
        locationRegionCode,
        yearsExperience,
        currentSalaryUsd,
        updatedAt: now,
      })
    }

    if (!profileResult.ok) {
      return NextResponse.json(
        {
          error: profileResult.message,
          code: profileResult.code ?? null,
        },
        { status: 500 },
      )
    }

    let brain:
      | { merged: false; reason?: string }
      | { merged: true; scope: "workspace" | "owner" } = { merged: false }

    if (mergeLlmToBrain) {
      try {
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
      } catch (brainError) {
        console.error(
          "[careeros onboarding step-three] brain merge failed (profile saved)",
          brainError,
        )
        brain = { merged: false, reason: "brain_merge_failed" }
      }
    }

    let onboardingStateWarning: string | null = null
    try {
      await mergeCareerOsOnboardingState(user.id, {
        step3CompletedAt: now,
        module_1_1_complete: true,
        module_1_2: {
          status: "running",
          startedAt: now,
        },
        ...(learningHoursPerWeek != null ? { learning_hours_per_week: learningHoursPerWeek } : {}),
        ...(currentSalaryUsd != null ? { stated_current_salary_usd: currentSalaryUsd } : {}),
        ...(locationRegionCode ? { location_region_code: locationRegionCode } : {}),
      })
    } catch (stateError) {
      onboardingStateWarning =
        stateError instanceof Error ? stateError.message : "Could not update onboarding state"
      console.error("[careeros onboarding step-three] onboarding state merge failed", stateError)
    }

    const onboardingCompletionId = randomUUID()
    let extractionQueued = true
    let extractionQueueError: string | null = null
    try {
      if (!process.env.INNGEST_EVENT_KEY?.trim()) {
        extractionQueued = false
        extractionQueueError = "INNGEST_EVENT_KEY is not set"
      } else {
        await sendCareerOSEvent({
          name: "careeros/profile.extract",
          data: {
            user_id: user.id,
            onboarding_completion_id: onboardingCompletionId,
          },
        })
      }
    } catch (queueError) {
      extractionQueued = false
      extractionQueueError =
        queueError instanceof Error ? queueError.message : "Could not queue profile extraction"
      console.error("[careeros onboarding step-three] profile.extract queue failed", queueError)
    }

    return NextResponse.json({
      ok: true,
      module_1_2: {
        status: extractionQueued ? "running" : "idle",
        onboardingCompletionId,
        extractionQueued,
        extractionQueueError,
      },
      profile: {
        currentRoleTitle,
        targetRoleTitle: targetRoleTitle || null,
        locationLabel,
        locationRegionCode,
        yearsExperience,
        currentSalaryUsd,
      },
      ...(onboardingStateWarning ? { onboardingStateWarning } : {}),
      ...(mergeLlmToBrain ? { brain } : {}),
    })
  } catch (error) {
    return jsonApiError(500, error, "careeros onboarding step-three")
  }
}

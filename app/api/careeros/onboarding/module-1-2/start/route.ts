import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { sendCareerOSEvent } from "@/lib/careeros/inngest/client"
import { mergeCareerOsOnboardingState } from "@/lib/careeros/onboarding/user-settings"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const onboardingCompletionId = randomUUID()
    await mergeCareerOsOnboardingState(user.id, {
      module_1_2: {
        status: "running",
        startedAt: new Date().toISOString(),
        onboardingCompletionId,
      },
    })
    await sendCareerOSEvent({
      name: "careeros/profile.extract",
      data: {
        user_id: user.id,
        onboarding_completion_id: onboardingCompletionId,
      },
    })

    return NextResponse.json({
      ok: true,
      status: "running",
      onboardingCompletionId,
    })
  } catch (error) {
    return jsonApiError(500, error, "careeros onboarding module-1-2 start")
  }
}

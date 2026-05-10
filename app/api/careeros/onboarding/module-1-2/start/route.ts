import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { mergeCareerOsOnboardingState } from "@/lib/careeros/onboarding/user-settings"
import { runModule12SkillExtraction } from "@/lib/careeros/onboarding/module-1-2"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
      const parsed = await runModule12SkillExtraction(user.id)
      return NextResponse.json({
        ok: true,
        status: "completed",
        summary: parsed.summary,
        skillsCount: parsed.topSkills.length,
        topSkills: parsed.topSkills.slice(0, 5).map((s) => s.skill),
      })
    } catch (error) {
      await mergeCareerOsOnboardingState(user.id, {
        module_1_2: {
          status: "failed",
          failedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        },
      })
      throw error
    }
  } catch (error) {
    return jsonApiError(500, error, "careeros onboarding module-1-2 start")
  }
}

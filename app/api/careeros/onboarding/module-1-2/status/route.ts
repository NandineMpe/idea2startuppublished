import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .schema("careeros")
      .from("user_settings")
      .select("onboarding_state")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) throw error

    const onboardingState = (data?.onboarding_state as Record<string, unknown> | null) ?? {}
    const module11 =
      onboardingState.module_1_1 &&
      typeof onboardingState.module_1_1 === "object" &&
      onboardingState.module_1_1 !== null
        ? (onboardingState.module_1_1 as Record<string, unknown>)
        : {}
    const module12 =
      module11.module_1_2 &&
      typeof module11.module_1_2 === "object" &&
      module11.module_1_2 !== null
        ? (module11.module_1_2 as Record<string, unknown>)
        : { status: "idle" }

    return NextResponse.json({ ok: true, module_1_2: module12 })
  } catch (error) {
    return jsonApiError(500, error, "careeros onboarding module-1-2 status")
  }
}

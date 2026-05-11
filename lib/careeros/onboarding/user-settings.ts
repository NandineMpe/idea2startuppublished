import { supabaseAdmin } from "@/lib/supabase"

export async function mergeCareerOsOnboardingState(
  userId: string,
  modulePatch: Record<string, unknown>,
): Promise<void> {
  const { data: existing, error: readError } = await supabaseAdmin
    .schema("careeros")
    .from("user_settings")
    .select(
      "notification_preferences, region_override_code, privacy_preferences, onboarding_state",
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (readError) throw readError

  const prevState =
    (existing?.onboarding_state as Record<string, unknown> | null | undefined) ?? {}
  const nextState = {
    ...prevState,
    module_1_1: {
      ...(typeof prevState.module_1_1 === "object" && prevState.module_1_1 !== null
        ? (prevState.module_1_1 as Record<string, unknown>)
        : {}),
      ...modulePatch,
    },
  }

  const now = new Date().toISOString()

  const { error } = await supabaseAdmin.schema("careeros").from("user_settings").upsert(
    {
      user_id: userId,
      notification_preferences:
        (existing?.notification_preferences as object | undefined) ?? {},
      region_override_code: existing?.region_override_code ?? null,
      privacy_preferences: (existing?.privacy_preferences as object | undefined) ?? {},
      onboarding_state: nextState,
      updated_at: now,
    },
    { onConflict: "user_id" },
  )

  if (error) throw error
}

/** Deep-merge into `onboarding_state.module_1_1.module_1_4` without wiping sibling keys (e.g. skill graph + embeddings). */
export async function mergeCareerOsModule14State(
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data: existing, error: readError } = await supabaseAdmin
    .schema("careeros")
    .from("user_settings")
    .select("onboarding_state")
    .eq("user_id", userId)
    .maybeSingle()

  if (readError) throw readError

  const prevState =
    (existing?.onboarding_state as Record<string, unknown> | null | undefined) ?? {}
  const m11 =
    typeof prevState.module_1_1 === "object" && prevState.module_1_1 !== null
      ? (prevState.module_1_1 as Record<string, unknown>)
      : {}
  const prev14 =
    typeof m11.module_1_4 === "object" && m11.module_1_4 !== null
      ? (m11.module_1_4 as Record<string, unknown>)
      : {}

  await mergeCareerOsOnboardingState(userId, {
    module_1_4: { ...prev14, ...patch },
  })
}

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CareerSettingsClient } from "./settings-client"

export default async function CareerSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/career")

  const { data: settings } = await supabase
    .schema("careeros")
    .from("user_settings")
    .select("onboarding_state")
    .eq("user_id", user.id)
    .maybeSingle()

  const { data: profile } = await supabase
    .schema("careeros")
    .from("user_profiles")
    .select("current_role_title,target_role_title,location_label,years_experience,current_salary_usd")
    .eq("user_id", user.id)
    .maybeSingle()

  const onboardingState = (settings?.onboarding_state as Record<string, unknown> | null) ?? {}
  const module11 = (onboardingState.module_1_1 as Record<string, unknown> | null) ?? {}
  const onboardingComplete = module11.module_1_1_complete === true

  return (
    <CareerSettingsClient
      email={user.email ?? ""}
      onboardingComplete={onboardingComplete}
      profile={profile ?? null}
    />
  )
}

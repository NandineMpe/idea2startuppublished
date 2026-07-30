import { redirect } from "next/navigation"
import {
  parseCareerDisplayPreferences,
  resolveCareerDisplayIdentity,
} from "@/lib/careeros/display-preferences"
import { loadCareerDashboardContext } from "@/lib/careeros/dashboard/load-career-dashboard"
import { createClient } from "@/lib/supabase/server"
import { CareerDashboardView } from "@/components/careeros/screens/dashboard-view"

export default async function CareerDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/career")

  const ctx = await loadCareerDashboardContext(supabase, user.id)

  const { data: settings } = await supabase
    .schema("careeros")
    .from("user_settings")
    .select("privacy_preferences")
    .eq("user_id", user.id)
    .maybeSingle()

  const displayPrefs = parseCareerDisplayPreferences(settings?.privacy_preferences)
  const identity = resolveCareerDisplayIdentity(displayPrefs, {
    email: user.email,
    user_metadata: user.user_metadata as Record<string, unknown> | undefined,
  })
  const userName = identity.name

  return (
    <CareerDashboardView
      ctx={ctx}
      userName={userName}
      locationLabel={ctx.profile?.location_label}
    />
  )
}

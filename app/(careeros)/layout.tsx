import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export default async function CareerOSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/career")
  }

  // Allow the onboarding route itself through — prevents a redirect loop.
  const headersList = await headers()
  const pathname = headersList.get("x-pathname") ?? ""
  const isOnboarding = pathname.startsWith("/careeros/onboarding")

  if (!isOnboarding) {
    const { data: settings } = await supabase
      .schema("careeros")
      .from("user_settings")
      .select("onboarding_state")
      .eq("user_id", user.id)
      .maybeSingle()

    const onboardingState = (settings?.onboarding_state as Record<string, unknown> | null) ?? {}
    const module11 = (onboardingState.module_1_1 as Record<string, unknown> | null) ?? {}
    const complete = module11.module_1_1_complete === true

    if (!complete) {
      redirect("/careeros/onboarding")
    }
  }

  return <>{children}</>
}

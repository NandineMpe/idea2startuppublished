import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OsPortalPage } from "@/components/access/os-portal-page"

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    // Route to the product the user actually belongs to.
    // CareerOS users have a row in careeros.user_profiles; everyone else goes to FounderOS.
    const { data: careerProfile } = await supabase
      .schema("careeros")
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()

    redirect(careerProfile ? "/career/dashboard" : "/dashboard")
  }

  return <OsPortalPage />
}

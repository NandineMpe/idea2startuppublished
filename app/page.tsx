import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OsPortalPage } from "@/components/access/os-portal-page"

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const product = (user.user_metadata?.product as string | undefined) ?? "founder"
    if (product === "career") redirect("/career/dashboard")
    if (product === "creator") redirect("/creator/dashboard")
    redirect("/dashboard")
  }

  return <OsPortalPage />
}

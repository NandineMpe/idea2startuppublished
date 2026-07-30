import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

/**
 * Creator screens are server components behind the dashboard layout, which already
 * redirects anonymous visitors. This repeats the check because a page must never
 * depend on its layout for authorisation, and returns the user id the loaders need.
 */
export async function requireCreatorUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/creator")

  return { supabase, userId: user.id }
}

import { createClient } from "@/lib/supabase/server"
import { CareerFeedView } from "@/components/careeros/screens/feed-view"

export const dynamic = "force-dynamic"

export default async function CareerOSFeedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let liveItemCount: number | undefined
  if (user) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .schema("careeros")
      .from("user_ai_feed_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("dismissed_at", null)
      .gte("feed_at", cutoff)
    liveItemCount = count ?? 0
  }

  return <CareerFeedView liveItemCount={liveItemCount} />
}

import { createClient } from "@/lib/supabase/server"
import { loadMarketIntelligenceForUser } from "@/lib/careeros/market/load-market-intelligence"
import { CareerMarketView } from "@/components/careeros/screens/market-view"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export default async function CareerOSMarketPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let initial = null
  if (user) {
    initial = await loadMarketIntelligenceForUser(user.id)
  }

  return <CareerMarketView initial={initial} signedIn={Boolean(user)} />
}

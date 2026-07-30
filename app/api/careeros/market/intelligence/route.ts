import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { loadMarketIntelligenceForUser } from "@/lib/careeros/market/load-market-intelligence"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await loadMarketIntelligenceForUser(user.id)
    return NextResponse.json(payload)
  } catch (e: unknown) {
    return jsonApiError(500, e, "careeros/market/intelligence GET")
  }
}

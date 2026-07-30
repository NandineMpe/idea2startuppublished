import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { queueMarketRefreshForUser } from "@/lib/careeros/market/load-market-intelligence"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * Queue demand, salary, and adjacent cache rebuild for the signed-in user's O*NET + region.
 */
export async function POST() {
  try {
    if (!process.env.INNGEST_EVENT_KEY?.trim()) {
      return NextResponse.json(
        { error: "INNGEST_EVENT_KEY is not set, so market refresh cannot be queued." },
        { status: 501 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await queueMarketRefreshForUser(user.id)
    if (!result.queued.length) {
      return NextResponse.json(
        {
          error:
            "Profile needs a target role, region, and configured O*NET + Inngest before market cache can refresh.",
        },
        { status: 400 },
      )
    }

    const mappedOnly =
      result.queued.length === 1 && result.queued[0] === "careeros/profile.onet-map"
    return NextResponse.json({
      ok: true,
      message: mappedOnly
        ? "O*NET mapping queued. Reload in a few minutes, then refresh cache again for demand and salary."
        : "Market refresh queued. Reload this page in a few minutes after Inngest finishes.",
      ...result,
    })
  } catch (e: unknown) {
    return jsonApiError(500, e, "careeros/market/refresh POST")
  }
}

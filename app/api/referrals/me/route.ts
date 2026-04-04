import { NextResponse } from "next/server"
import { headers } from "next/headers"
import {
  buildProductInviteShareUrl,
  countReferralsForUser,
  ensureReferralCodeForUser,
} from "@/lib/referrals"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const code = await ensureReferralCodeForUser(user.id)
    const inviteCount = await countReferralsForUser(user.id)

    const h = await headers()
    const proto = h.get("x-forwarded-proto") ?? "https"
    const host = h.get("x-forwarded-host") ?? h.get("host")
    const origin = host ? `${proto}://${host}` : null
    const shareUrl = buildProductInviteShareUrl(code, origin)

    return NextResponse.json({ code, shareUrl, inviteCount })
  } catch (e) {
    console.error("[referrals/me]", e)
    return NextResponse.json({ error: "Could not load referral link." }, { status: 500 })
  }
}

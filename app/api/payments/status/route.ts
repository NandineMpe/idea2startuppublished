import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getBillingAccountForUser,
  getBillingStatusLabel,
  isBillingAccessActive,
} from "@/lib/payments/access"
import { getLemonSqueezySettings } from "@/lib/payments/lemonsqueezy"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const billing = await getBillingAccountForUser(user.id)
    const settings = getLemonSqueezySettings()
    const isActive = isBillingAccessActive(billing)

    return NextResponse.json({
      enabled: settings.enabled,
      provider: settings.provider,
      isActive,
      status: billing?.status ?? "pending",
      statusLabel: getBillingStatusLabel(billing?.status ?? "pending"),
      billing,
      defaultPromoCode: settings.defaultPromoCode,
      planName: settings.planName,
      planDescription: settings.planDescription,
      testMode: settings.testMode,
    })
  } catch (error) {
    console.error("[payments/status] GET:", error)
    return NextResponse.json({ error: "Failed to load payment status" }, { status: 500 })
  }
}

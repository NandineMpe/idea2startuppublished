import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getBillingAccountForUser,
  isBillingAccessActive,
  upsertBillingAccountForUser,
} from "@/lib/payments/access"
import { createLemonSqueezyCheckout, getLemonSqueezySettings } from "@/lib/payments/lemonsqueezy"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const settings = getLemonSqueezySettings()
    if (!settings.enabled) {
      return NextResponse.json(
        { error: "Billing is not configured yet. Add the Lemon Squeezy env vars first." },
        { status: 503 },
      )
    }

    const existing = await getBillingAccountForUser(user.id)
    if (isBillingAccessActive(existing)) {
      return NextResponse.json(
        { error: "This account already has active access.", redirectTo: "/dashboard" },
        { status: 409 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as { promoCode?: string | null }
    const checkout = await createLemonSqueezyCheckout({
      userId: user.id,
      email: user.email ?? "",
      name:
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : null,
      promoCode: body.promoCode,
      origin: new URL(request.url).origin,
    })

    await upsertBillingAccountForUser(user.id, {
      status: existing?.status === "refunded" ? "pending" : existing?.status ?? "pending",
      customer_email: user.email ?? existing?.customerEmail ?? null,
      customer_name:
        (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
        (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
        existing?.customerName ||
        null,
      provider_checkout_id: checkout.id,
      last_checkout_url: checkout.url,
      promo_code: body.promoCode?.trim() || settings.defaultPromoCode,
      metadata: {
        source: "paywall",
        preview: checkout.preview ?? null,
        test_mode: checkout.testMode,
      },
    })

    return NextResponse.json({
      ok: true,
      provider: settings.provider,
      url: checkout.url,
      preview: checkout.preview,
      testMode: checkout.testMode,
    })
  } catch (error) {
    console.error("[payments/checkout] POST:", error)
    const message = error instanceof Error ? error.message : "Failed to create checkout"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

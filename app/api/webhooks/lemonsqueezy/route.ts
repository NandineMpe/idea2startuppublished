import crypto from "node:crypto"
import { NextResponse } from "next/server"
import {
  BILLING_PROVIDER,
  logBillingWebhookEvent,
  upsertBillingAccountForUser,
} from "@/lib/payments/access"

type BillingStatusPatch =
  | "pending"
  | "paid"
  | "active"
  | "on_trial"
  | "past_due"
  | "cancelled"
  | "expired"
  | "unpaid"
  | "paused"
  | "refunded"

function asNullableString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === "number") return String(value)
  return null
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function verifySignature(rawBody: string, signatureHex: string | null, secret: string): boolean {
  if (!signatureHex) return false

  const signature = Buffer.from(signatureHex, "hex")
  if (signature.length === 0 || rawBody.length === 0) return false

  const digest = Buffer.from(
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex"),
    "hex",
  )

  return digest.length === signature.length && crypto.timingSafeEqual(digest, signature)
}

function mapStatus(eventName: string, payload: Record<string, unknown>): BillingStatusPatch | null {
  const data = asObject(payload.data)
  const attributes = asObject(data.attributes)
  const status = asNullableString(attributes.status)

  if (eventName === "order_created") return "paid"
  if (eventName === "order_refunded") return "refunded"

  if (
    status === "active" ||
    status === "on_trial" ||
    status === "past_due" ||
    status === "cancelled" ||
    status === "expired" ||
    status === "unpaid" ||
    status === "paused"
  ) {
    return status
  }

  return null
}

function buildPatch(eventName: string, payload: Record<string, unknown>) {
  const data = asObject(payload.data)
  const attributes = asObject(data.attributes)
  const custom = asObject(asObject(payload.meta).custom_data)
  const firstSubscriptionItem = asObject(attributes.first_subscription_item)
  const firstOrderItem = asObject(attributes.first_order_item)
  const status = mapStatus(eventName, payload)
  const now = new Date().toISOString()

  if (!status) return null

  const patch = {
    status,
    customer_email: asNullableString(attributes.user_email),
    customer_name: asNullableString(attributes.user_name),
    provider_customer_id: asNullableString(attributes.customer_id),
    provider_order_id:
      eventName.startsWith("order_")
        ? asNullableString(data.id)
        : asNullableString(attributes.order_id),
    provider_subscription_id:
      data.type === "subscriptions" ? asNullableString(data.id) : asNullableString(attributes.subscription_id),
    provider_variant_id:
      asNullableString(attributes.variant_id) ??
      asNullableString(firstSubscriptionItem.variant_id) ??
      asNullableString(firstOrderItem.variant_id),
    promo_code:
      asNullableString(attributes.discount_code) ?? asNullableString(attributes.discount_name),
    last_event_name: eventName,
    last_event_at: asNullableString(attributes.updated_at) ?? asNullableString(attributes.created_at) ?? now,
    metadata: {
      event_name: eventName,
      test_mode: Boolean(asObject(payload.meta).test_mode),
      data_type: asNullableString(data.type),
      order_identifier: asNullableString(attributes.identifier),
      product_name: asNullableString(attributes.product_name),
      variant_name: asNullableString(attributes.variant_name),
      urls: asObject(attributes.urls),
    },
  } as Record<string, unknown>

  if (status === "paid" || status === "active" || status === "on_trial") {
    patch.access_granted_at = asNullableString(attributes.created_at) ?? now
    patch.access_expires_at = null
  } else if (
    status === "cancelled" ||
    status === "past_due" ||
    status === "unpaid" ||
    status === "paused" ||
    status === "expired" ||
    status === "refunded"
  ) {
    patch.access_expires_at =
      asNullableString(attributes.ends_at) ??
      (status === "refunded" || status === "expired" ? now : null)
  }

  return {
    userId: asNullableString(custom.user_id),
    patch,
  }
}

export async function POST(request: Request) {
  try {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim()
    if (!secret) {
      return NextResponse.json(
        { error: "Missing LEMONSQUEEZY_WEBHOOK_SECRET" },
        { status: 500 },
      )
    }

    const rawBody = await request.text()
    if (!verifySignature(rawBody, request.headers.get("X-Signature"), secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>
    const data = asObject(payload.data)
    const eventName =
      asNullableString(asObject(payload.meta).event_name) ??
      asNullableString(request.headers.get("X-Event-Name")) ??
      "unknown"

    const patchResult = buildPatch(eventName, payload)

    await logBillingWebhookEvent({
      eventName,
      resourceType: asNullableString(data.type),
      resourceId: asNullableString(data.id),
      userId: patchResult?.userId,
      payload,
    })

    if (!patchResult?.userId) {
      return NextResponse.json({
        ok: true,
        provider: BILLING_PROVIDER,
        ignored: true,
        reason: "Missing custom_data.user_id",
      })
    }

    await upsertBillingAccountForUser(patchResult.userId, patchResult.patch)

    return NextResponse.json({
      ok: true,
      provider: BILLING_PROVIDER,
      eventName,
      userId: patchResult.userId,
    })
  } catch (error) {
    console.error("[webhooks/lemonsqueezy] POST:", error)
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 })
  }
}

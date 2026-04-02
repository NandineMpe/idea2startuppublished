import { supabaseAdmin } from "@/lib/supabase"

export const BILLING_PROVIDER = "lemonsqueezy"

export const BILLING_STATUSES = [
  "pending",
  "paid",
  "active",
  "on_trial",
  "past_due",
  "cancelled",
  "expired",
  "unpaid",
  "paused",
  "refunded",
] as const

export type BillingStatus = (typeof BILLING_STATUSES)[number]

export interface BillingAccountRecord {
  id: string
  userId: string
  provider: string
  status: BillingStatus
  customerEmail: string | null
  customerName: string | null
  providerCustomerId: string | null
  providerOrderId: string | null
  providerSubscriptionId: string | null
  providerVariantId: string | null
  providerCheckoutId: string | null
  lastCheckoutUrl: string | null
  promoCode: string | null
  lastEventName: string | null
  lastEventAt: string | null
  accessGrantedAt: string | null
  accessExpiresAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

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

function normalizeBillingStatus(value: unknown): BillingStatus {
  if (typeof value === "string" && BILLING_STATUSES.includes(value as BillingStatus)) {
    return value as BillingStatus
  }
  return "pending"
}

function mapBillingRecord(row: Record<string, unknown>): BillingAccountRecord {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    provider: asNullableString(row.provider) ?? BILLING_PROVIDER,
    status: normalizeBillingStatus(row.status),
    customerEmail: asNullableString(row.customer_email),
    customerName: asNullableString(row.customer_name),
    providerCustomerId: asNullableString(row.provider_customer_id),
    providerOrderId: asNullableString(row.provider_order_id),
    providerSubscriptionId: asNullableString(row.provider_subscription_id),
    providerVariantId: asNullableString(row.provider_variant_id),
    providerCheckoutId: asNullableString(row.provider_checkout_id),
    lastCheckoutUrl: asNullableString(row.last_checkout_url),
    promoCode: asNullableString(row.promo_code),
    lastEventName: asNullableString(row.last_event_name),
    lastEventAt: asNullableString(row.last_event_at),
    accessGrantedAt: asNullableString(row.access_granted_at),
    accessExpiresAt: asNullableString(row.access_expires_at),
    metadata: asObject(row.metadata),
    createdAt: asNullableString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: asNullableString(row.updated_at) ?? new Date(0).toISOString(),
  }
}

function isFutureIsoDate(value: string | null): boolean {
  if (!value) return false
  const time = Date.parse(value)
  if (Number.isNaN(time)) return false
  return time > Date.now()
}

export function isBillingAccessActive(record: BillingAccountRecord | null): boolean {
  if (!record) return false

  if (record.status === "active" || record.status === "paid" || record.status === "on_trial") {
    return true
  }

  if (
    record.status === "cancelled" ||
    record.status === "past_due" ||
    record.status === "paused" ||
    record.status === "unpaid"
  ) {
    return isFutureIsoDate(record.accessExpiresAt)
  }

  return false
}

export function getBillingStatusLabel(status: BillingStatus): string {
  switch (status) {
    case "paid":
      return "Paid"
    case "active":
      return "Active"
    case "on_trial":
      return "Trialing"
    case "past_due":
      return "Past due"
    case "cancelled":
      return "Cancelled"
    case "expired":
      return "Expired"
    case "unpaid":
      return "Unpaid"
    case "paused":
      return "Paused"
    case "refunded":
      return "Refunded"
    default:
      return "Pending"
  }
}

export async function getBillingAccountForUser(userId: string): Promise<BillingAccountRecord | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("billing_accounts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (error) {
      console.error("[billing] getBillingAccountForUser:", error.message)
      return null
    }

    return data ? mapBillingRecord(data as unknown as Record<string, unknown>) : null
  } catch (error) {
    console.error("[billing] getBillingAccountForUser:", error)
    return null
  }
}

export async function upsertBillingAccountForUser(
  userId: string,
  patch: Record<string, unknown>,
): Promise<BillingAccountRecord> {
  const payload = {
    user_id: userId,
    provider: BILLING_PROVIDER,
    ...patch,
  }

  const { data, error } = await supabaseAdmin
    .from("billing_accounts")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Failed to save billing account")
  }

  return mapBillingRecord(data as unknown as Record<string, unknown>)
}

export async function logBillingWebhookEvent(params: {
  eventName: string
  resourceType?: string | null
  resourceId?: string | null
  userId?: string | null
  payload: Record<string, unknown>
}) {
  const { error } = await supabaseAdmin.from("billing_webhook_events").insert({
    provider: BILLING_PROVIDER,
    event_name: params.eventName,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    user_id: params.userId ?? null,
    payload: params.payload,
  })

  if (error) {
    console.error("[billing] logBillingWebhookEvent:", error.message)
  }
}

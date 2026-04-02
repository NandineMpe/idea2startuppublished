import { resolveAppUrl } from "@/lib/app-url"

export const DEFAULT_PROMO_CODE = "USEJUNO"
export const DEFAULT_PLAN_NAME = "Juno Founding Access"
export const DEFAULT_PLAN_DESCRIPTION =
  "Keep your company context in one place and wake up to presidential-level intelligence."

export const LEMON_SQUEEZY_WEBHOOK_EVENTS = [
  "order_created",
  "order_refunded",
  "subscription_created",
  "subscription_updated",
  "subscription_expired",
] as const

interface LemonSqueezyCheckoutPreview {
  currency: string | null
  subtotalFormatted: string | null
  discountTotalFormatted: string | null
  totalFormatted: string | null
}

export interface LemonSqueezyCheckout {
  id: string
  url: string
  preview: LemonSqueezyCheckoutPreview | null
  testMode: boolean
}

interface LemonSqueezyConfig {
  apiKey: string | null
  storeId: string | null
  variantId: string | null
  defaultPromoCode: string
  planName: string
  planDescription: string
  testMode: boolean
}

function readConfig(): LemonSqueezyConfig {
  return {
    apiKey: process.env.LEMONSQUEEZY_API_KEY?.trim() || null,
    storeId: process.env.LEMONSQUEEZY_STORE_ID?.trim() || null,
    variantId: process.env.LEMONSQUEEZY_VARIANT_ID?.trim() || null,
    defaultPromoCode: process.env.LEMONSQUEEZY_PROMO_CODE?.trim() || DEFAULT_PROMO_CODE,
    planName: process.env.NEXT_PUBLIC_JUNO_PLAN_NAME?.trim() || DEFAULT_PLAN_NAME,
    planDescription:
      process.env.NEXT_PUBLIC_JUNO_PLAN_DESCRIPTION?.trim() || DEFAULT_PLAN_DESCRIPTION,
    testMode: process.env.LEMONSQUEEZY_TEST_MODE === "true",
  }
}

function requireConfig(): Required<LemonSqueezyConfig> {
  const config = readConfig()
  if (!config.apiKey || !config.storeId || !config.variantId) {
    throw new Error(
      "Missing Lemon Squeezy billing env. Set LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, and LEMONSQUEEZY_VARIANT_ID.",
    )
  }

  return {
    apiKey: config.apiKey,
    storeId: config.storeId,
    variantId: config.variantId,
    defaultPromoCode: config.defaultPromoCode,
    planName: config.planName,
    planDescription: config.planDescription,
    testMode: config.testMode,
  }
}

async function lemonsqueezyRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey } = requireConfig()
  const response = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })

  const raw = await response.text()
  if (!response.ok) {
    throw new Error(`Lemon Squeezy API ${response.status}: ${raw.slice(0, 280)}`)
  }

  return JSON.parse(raw) as T
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

export function getLemonSqueezySettings() {
  const config = readConfig()
  return {
    enabled: Boolean(config.apiKey && config.storeId && config.variantId),
    provider: "Lemon Squeezy",
    planName: config.planName,
    planDescription: config.planDescription,
    defaultPromoCode: config.defaultPromoCode,
    testMode: config.testMode,
  }
}

export async function createLemonSqueezyCheckout(params: {
  userId: string
  email: string
  name?: string | null
  promoCode?: string | null
  origin?: string | null
}): Promise<LemonSqueezyCheckout> {
  const config = requireConfig()
  const appUrl = resolveAppUrl(params.origin)
  const variantId = Number(config.variantId)

  if (Number.isNaN(variantId)) {
    throw new Error("LEMONSQUEEZY_VARIANT_ID must be numeric.")
  }

  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        product_options: {
          name: config.planName,
          description: config.planDescription,
          redirect_url: `${appUrl}/paywall/success`,
          receipt_button_text: "Open Juno",
          receipt_link_url: `${appUrl}/dashboard`,
          receipt_thank_you_note:
            "Your access is ready. Come back into Juno and keep the company context together.",
          enabled_variants: [variantId],
        },
        checkout_options: {
          media: false,
          logo: true,
          desc: true,
          discount: true,
          subscription_preview: true,
          button_color: "#e2f2ff",
        },
        checkout_data: {
          email: params.email,
          name: params.name ?? "",
          discount_code: params.promoCode?.trim() || config.defaultPromoCode,
          custom: {
            user_id: params.userId,
            source: "juno-paywall",
          },
        },
        preview: true,
        test_mode: config.testMode,
      },
      relationships: {
        store: {
          data: {
            type: "stores",
            id: config.storeId,
          },
        },
        variant: {
          data: {
            type: "variants",
            id: config.variantId,
          },
        },
      },
    },
  }

  const response = await lemonsqueezyRequest<{
    data?: {
      id?: string
      attributes?: Record<string, unknown>
    }
  }>("/checkouts", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  const checkoutId = asNullableString(response.data?.id)
  const attributes = asObject(response.data?.attributes)
  const url = asNullableString(attributes.url)

  if (!checkoutId || !url) {
    throw new Error("Lemon Squeezy checkout response was missing the checkout URL.")
  }

  const preview = asObject(attributes.preview)

  return {
    id: checkoutId,
    url,
    preview: Object.keys(preview).length
      ? {
          currency: asNullableString(preview.currency),
          subtotalFormatted: asNullableString(preview.subtotal_formatted),
          discountTotalFormatted: asNullableString(preview.discount_total_formatted),
          totalFormatted: asNullableString(preview.total_formatted),
        }
      : null,
    testMode: Boolean(attributes.test_mode),
  }
}

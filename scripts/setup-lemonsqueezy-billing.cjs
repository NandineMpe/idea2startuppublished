/**
 * Bootstraps the Juno Lemon Squeezy billing resources.
 *
 * What it can do:
 * - Create or update the billing webhook for /api/webhooks/lemonsqueezy
 * - Optionally create the USEJUNO promo code when LEMONSQUEEZY_PROMO_PERCENT is set
 *
 * Required env:
 * - LEMONSQUEEZY_API_KEY
 * - LEMONSQUEEZY_STORE_ID
 * - NEXT_PUBLIC_APP_URL
 *
 * Recommended env:
 * - LEMONSQUEEZY_WEBHOOK_SECRET
 * - LEMONSQUEEZY_VARIANT_ID
 * - LEMONSQUEEZY_PROMO_CODE=USEJUNO
 * - LEMONSQUEEZY_PROMO_PERCENT=20
 * - LEMONSQUEEZY_TEST_MODE=true
 */

const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const DEFAULT_PROMO_CODE = "USEJUNO"
const WEBHOOK_EVENTS = [
  "order_created",
  "order_refunded",
  "subscription_created",
  "subscription_updated",
  "subscription_expired",
]

function loadEnvFile(filename) {
  const fullPath = path.join(__dirname, "..", filename)
  if (!fs.existsSync(fullPath)) return

  const text = fs.readFileSync(fullPath, "utf8")
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function asString(value) {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (typeof value === "number") return String(value)
  return null
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value
}

function normalizeBaseUrl(value) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`
  return withProtocol.replace(/\/+$/, "")
}

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required env: ${name}`)
  }
  return value
}

function generateWebhookSecret() {
  return crypto.randomBytes(20).toString("hex").slice(0, 40)
}

async function lemonsqueezyRequest(apiKey, route, init = {}) {
  const response = await fetch(`https://api.lemonsqueezy.com/v1${route}`, {
    ...init,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
  })

  const raw = await response.text()
  if (!response.ok) {
    throw new Error(`Lemon Squeezy API ${response.status}: ${raw.slice(0, 300)}`)
  }

  return raw ? JSON.parse(raw) : {}
}

async function ensureWebhook({
  apiKey,
  storeId,
  webhookUrl,
  webhookSecret,
  testMode,
}) {
  const list = await lemonsqueezyRequest(
    apiKey,
    `/webhooks?filter[store_id]=${encodeURIComponent(storeId)}`,
  )

  const existing = (Array.isArray(list.data) ? list.data : []).find((entry) => {
    const attributes = asObject(entry.attributes)
    return (
      asString(attributes.url) === webhookUrl &&
      Boolean(attributes.test_mode) === testMode
    )
  })

  const payload = {
    data: {
      type: "webhooks",
      attributes: {
        url: webhookUrl,
        events: WEBHOOK_EVENTS,
        secret: webhookSecret,
        test_mode: testMode,
      },
      relationships: {
        store: {
          data: {
            type: "stores",
            id: storeId,
          },
        },
      },
    },
  }

  if (existing?.id) {
    payload.data.id = String(existing.id)
    const updated = await lemonsqueezyRequest(apiKey, `/webhooks/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })

    return {
      action: "updated",
      id: asString(updated?.data?.id),
      url: webhookUrl,
    }
  }

  const created = await lemonsqueezyRequest(apiKey, "/webhooks", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  return {
    action: "created",
    id: asString(created?.data?.id),
    url: webhookUrl,
  }
}

async function ensurePromoDiscount({
  apiKey,
  storeId,
  promoCode,
  promoPercent,
  testMode,
}) {
  if (!promoPercent) {
    return {
      skipped: true,
      reason: "Set LEMONSQUEEZY_PROMO_PERCENT to auto-create the promo code.",
    }
  }

  const list = await lemonsqueezyRequest(
    apiKey,
    `/discounts?filter[store_id]=${encodeURIComponent(storeId)}`,
  )

  const existing = (Array.isArray(list.data) ? list.data : []).find((entry) => {
    const attributes = asObject(entry.attributes)
    return (
      asString(attributes.code)?.toUpperCase() === promoCode.toUpperCase() &&
      Boolean(attributes.test_mode) === testMode
    )
  })

  if (existing?.id) {
    return {
      action: "existing",
      id: asString(existing.id),
      code: promoCode,
    }
  }

  const created = await lemonsqueezyRequest(apiKey, "/discounts", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "discounts",
        attributes: {
          name: `${promoCode} ${promoPercent}%`,
          code: promoCode,
          amount: Number(promoPercent),
          amount_type: "percent",
          duration: "once",
          is_limited_to_products: false,
          test_mode: testMode,
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
        },
      },
    }),
  })

  return {
    action: "created",
    id: asString(created?.data?.id),
    code: promoCode,
  }
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")
  loadEnvFile(".env.vercel.local")

  const apiKey = requireEnv("LEMONSQUEEZY_API_KEY")
  const storeId = requireEnv("LEMONSQUEEZY_STORE_ID")
  const appUrl = normalizeBaseUrl(requireEnv("NEXT_PUBLIC_APP_URL"))
  const promoCode = process.env.LEMONSQUEEZY_PROMO_CODE?.trim() || DEFAULT_PROMO_CODE
  const promoPercent = process.env.LEMONSQUEEZY_PROMO_PERCENT?.trim() || null
  const testMode = process.env.LEMONSQUEEZY_TEST_MODE === "true"
  const webhookSecret =
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim() || generateWebhookSecret()
  const webhookUrl = `${appUrl}/api/webhooks/lemonsqueezy`

  console.log(`Using store ${storeId} (${testMode ? "test mode" : "live mode"})`)
  console.log(`Webhook target: ${webhookUrl}`)

  const webhook = await ensureWebhook({
    apiKey,
    storeId,
    webhookUrl,
    webhookSecret,
    testMode,
  })

  const discount = await ensurePromoDiscount({
    apiKey,
    storeId,
    promoCode,
    promoPercent,
    testMode,
  })

  console.log("")
  console.log(`Webhook ${webhook.action}: ${webhook.id || "(unknown id)"}`)
  console.log(`Webhook URL: ${webhook.url}`)

  if (discount.skipped) {
    console.log(`Promo skipped: ${discount.reason}`)
  } else {
    console.log(`Promo ${discount.action}: ${discount.code} (${discount.id || "unknown id"})`)
  }

  console.log("")
  console.log("Env to keep:")
  console.log(`LEMONSQUEEZY_WEBHOOK_SECRET=${webhookSecret}`)
  console.log(`LEMONSQUEEZY_PROMO_CODE=${promoCode}`)
  if (promoPercent) {
    console.log(`LEMONSQUEEZY_PROMO_PERCENT=${promoPercent}`)
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})

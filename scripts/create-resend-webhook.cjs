/**
 * One-off: create Resend webhook for GTM outreach events.
 * Usage: RESEND_API_KEY=re_xxx node scripts/create-resend-webhook.cjs
 * Or:    node scripts/create-resend-webhook.cjs  (reads .env.vercel.local if present)
 */
const fs = require("fs")
const path = require("path")
const { Resend } = require("resend")

const ENDPOINT = "https://idea2startuppublished.vercel.app/api/webhooks/resend"
const EVENTS = ["email.opened", "email.clicked", "email.bounced", "email.complained"]

function loadKey() {
  if (process.env.RESEND_API_KEY?.trim()) return process.env.RESEND_API_KEY.trim()
  const p = path.join(__dirname, "..", ".env.vercel.local")
  if (!fs.existsSync(p)) return null
  const env = fs.readFileSync(p, "utf8")
  const m = env.match(/RESEND_API_KEY=(.+)/)
  if (!m) return null
  return m[1].replace(/^["']|["']$/g, "").trim()
}

async function main() {
  const key = loadKey()
  if (!key) {
    console.error("Set RESEND_API_KEY or run: npx vercel env pull .env.vercel.local")
    process.exit(1)
  }

  const resend = new Resend(key)

  const list = await resend.webhooks.list()
  if (list.error) {
    console.error(list.error)
    process.exit(1)
  }

  const hooks = list.data?.data ?? []
  const existing = hooks.find((w) => w.endpoint === ENDPOINT)
  if (existing) {
    console.log("Webhook already exists for this URL:", existing.id)
    console.log("Update events in dashboard or delete and re-run if needed.")
    process.exit(0)
  }

  const created = await resend.webhooks.create({
    endpoint: ENDPOINT,
    events: EVENTS,
  })

  if (created.error) {
    console.error(created.error)
    process.exit(1)
  }

  console.log("Created webhook:", created.data?.id)
  if (created.data?.signing_secret) {
    console.log("")
    console.log("Add this to Vercel (and local) as RESEND_WEBHOOK_SECRET for Svix verification:")
    console.log(created.data.signing_secret)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

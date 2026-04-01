/**
 * One-off: create AgentMail webhook for Juno outreach events.
 * Usage: AGENTMAIL_API_KEY=am_xxx node scripts/create-agentmail-webhook.cjs
 * Or:    node scripts/create-agentmail-webhook.cjs  (reads .env.vercel.local if present)
 */
const fs = require("fs")
const path = require("path")
const { AgentMailClient } = require("agentmail")

const ENDPOINT =
  process.env.AGENTMAIL_WEBHOOK_URL?.trim() ||
  "https://idea2startuppublished.vercel.app/api/webhooks/agentmail"
const EVENTS = [
  "message.received",
  "message.sent",
  "message.delivered",
  "message.bounced",
  "message.complained",
  "message.rejected",
]

function loadEnvValue(name) {
  if (process.env[name]?.trim()) return process.env[name].trim()
  const p = path.join(__dirname, "..", ".env.vercel.local")
  if (!fs.existsSync(p)) return null
  const env = fs.readFileSync(p, "utf8")
  const m = env.match(new RegExp(`${name}=(.+)`))
  if (!m) return null
  return m[1].replace(/^["']|["']$/g, "").trim()
}

async function main() {
  const apiKey = loadEnvValue("AGENTMAIL_API_KEY")
  const inboxId = loadEnvValue("AGENTMAIL_INBOX_ID")

  if (!apiKey) {
    console.error("Set AGENTMAIL_API_KEY or run: npx vercel env pull .env.vercel.local")
    process.exit(1)
  }
  if (inboxId) {
    console.log("Scoping webhook to AgentMail inbox ID:", inboxId)
  }

  const client = new AgentMailClient({ apiKey })
  const list = await client.webhooks.list()
  const existing = (list.webhooks ?? []).find((w) => w.url === ENDPOINT)
  if (existing) {
    console.log("Webhook already exists for this URL:", existing.webhookId)
    console.log("Current secret starts with:", existing.secret?.slice(0, 12) || "(hidden)")
    process.exit(0)
  }

  const created = await client.webhooks.create({
    url: ENDPOINT,
    eventTypes: EVENTS,
    inboxIds: inboxId ? [inboxId] : undefined,
    clientId: "juno-outreach-webhook",
  })

  console.log("Created webhook:", created.webhookId)
  console.log("")
  console.log("Add this to Vercel (and local) as AGENTMAIL_WEBHOOK_SECRET:")
  console.log(created.secret)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

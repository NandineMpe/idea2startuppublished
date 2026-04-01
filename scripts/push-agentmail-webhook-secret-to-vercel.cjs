/**
 * Fetches secret for an AgentMail webhook and sets AGENTMAIL_WEBHOOK_SECRET on Vercel production.
 * Usage: WEBHOOK_ID=uuid node scripts/push-agentmail-webhook-secret-to-vercel.cjs
 */
const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")
const { AgentMailClient } = require("agentmail")

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
  const webhookId = process.env.WEBHOOK_ID?.trim()

  if (!apiKey) {
    console.error("Missing AGENTMAIL_API_KEY")
    process.exit(1)
  }
  if (!webhookId) {
    console.error("Missing WEBHOOK_ID")
    process.exit(1)
  }

  const client = new AgentMailClient({ apiKey })
  const webhook = await client.webhooks.get(webhookId)
  if (!webhook.secret) {
    console.error("No webhook secret returned")
    process.exit(1)
  }

  const r = spawnSync(
    "npx",
    [
      "vercel",
      "env",
      "add",
      "AGENTMAIL_WEBHOOK_SECRET",
      "production",
      "--sensitive",
      "--yes",
      "--value",
      webhook.secret,
    ],
    {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
      shell: true,
    },
  )
  process.exit(r.status ?? 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

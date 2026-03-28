/**
 * Fetches signing_secret for a webhook from Resend and sets RESEND_WEBHOOK_SECRET on Vercel production.
 * Usage: WEBHOOK_ID=uuid node scripts/push-resend-webhook-secret-to-vercel.cjs
 */
const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")
const { Resend } = require("resend")

function loadKey() {
  if (process.env.RESEND_API_KEY?.trim()) return process.env.RESEND_API_KEY.trim()
  const p = path.join(__dirname, "..", ".env.vercel.local")
  if (!fs.existsSync(p)) return null
  const env = fs.readFileSync(p, "utf8")
  const m = env.match(/RESEND_API_KEY=(.+)/)
  if (!m) return null
  return m[1].replace(/^["']|["']$/g, "").trim()
}

const WEBHOOK_ID = process.env.WEBHOOK_ID || "00b80584-2ea7-442b-8fa1-fb2a8e1430e1"

async function main() {
  const key = loadKey()
  if (!key) {
    console.error("Missing RESEND_API_KEY")
    process.exit(1)
  }
  const resend = new Resend(key)
  const got = await resend.webhooks.get(WEBHOOK_ID)
  if (got.error || !got.data?.signing_secret) {
    console.error(got.error || "no signing_secret")
    process.exit(1)
  }
  const secret = got.data.signing_secret
  const r = spawnSync(
    "npx",
    [
      "vercel",
      "env",
      "add",
      "RESEND_WEBHOOK_SECRET",
      "production",
      "--sensitive",
      "--yes",
      "--value",
      secret,
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

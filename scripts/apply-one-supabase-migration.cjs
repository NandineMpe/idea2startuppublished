/**
 * Apply a single SQL migration file to Supabase using the Management API.
 *
 * Usage:
 *   node scripts/apply-one-supabase-migration.cjs supabase/migrations/<file>.sql
 */

const fs = require("fs")
const path = require("path")

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, "utf8")
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

async function main() {
  const migrationPathArg = process.argv[2]
  if (!migrationPathArg) {
    throw new Error("Pass a migration file path, e.g. supabase/migrations/123_name.sql")
  }

  const root = path.resolve(__dirname, "..")
  const migrationPath = path.resolve(root, migrationPathArg)
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`)
  }

  loadEnvFile(path.join(root, ".env.local"))
  loadEnvFile(path.join(root, ".env"))

  const token = (process.env.SUPABASE_ACCESS_TOKEN || "").trim()
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  ).trim()

  if (!token || !url) {
    throw new Error("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_URL in env files")
  }

  const ref = new URL(url).hostname.replace(".supabase.co", "")
  const query = fs.readFileSync(migrationPath, "utf8")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000)

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      }
    )

    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Supabase API ${response.status}: ${text}`)
    }

    console.log(`Applied migration: ${migrationPathArg}`)
    if (text) console.log(text)
  } finally {
    clearTimeout(timeout)
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})

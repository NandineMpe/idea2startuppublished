/**
 * Apply one SQL file via Supabase Management API (same as apply-all Mode B).
 * Usage: node scripts/run-single-migration.cjs <relative-path-under-repo>
 * Env: SUPABASE_ACCESS_TOKEN + NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL).
 * Loads repo-root .env then .env.vercel.preview if keys missing.
 */

const fs = require("fs")
const path = require("path")

function loadEnvFile(rel) {
  const p = path.join(__dirname, "..", rel)
  if (!fs.existsSync(p)) return
  const text = fs.readFileSync(p, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

async function main() {
  const rel = process.argv[2]
  if (!rel) {
    console.error("Usage: node scripts/run-single-migration.cjs <path/to/migration.sql>")
    process.exit(1)
  }

  loadEnvFile(".env")
  loadEnvFile(".env.vercel.preview")
  loadEnvFile(".env.vercel.production")

  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()

  if (!token || !url) {
    console.error("Need SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL).")
    process.exit(1)
  }

  const sqlPath = path.join(__dirname, "..", rel)
  if (!fs.existsSync(sqlPath)) {
    console.error("File not found:", sqlPath)
    process.exit(1)
  }

  const query = fs.readFileSync(sqlPath, "utf8")
  const host = new URL(url).hostname
  const ref = host.replace(".supabase.co", "")
  if (!ref || ref === host) {
    console.error("Could not parse project ref from URL:", url)
    process.exit(1)
  }

  process.stdout.write(`Applying ${rel} to project ${ref} ... `)
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  })

  const text = await res.text()
  if (!res.ok) {
    console.log("FAILED")
    console.error(res.status, text)
    process.exit(1)
  }
  console.log("ok")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

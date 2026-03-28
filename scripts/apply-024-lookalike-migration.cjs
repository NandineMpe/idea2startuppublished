/**
 * Applies supabase/migrations/024_lookalike_profiles.sql via Supabase Management API.
 *
 * Requires a personal access token (not the anon or service_role JWT):
 *   Dashboard → Account → Access Tokens → Generate new token
 *   Scopes: include database write / project scope for your org.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
 *   node scripts/apply-024-lookalike-migration.cjs
 */

const fs = require("fs")
const path = require("path")

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
  if (!token || !url) {
    console.error("Set SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL).")
    process.exit(1)
  }

  const host = new URL(url).hostname
  const ref = host.replace(".supabase.co", "")
  if (!ref || ref === host) {
    console.error("Could not parse project ref from URL:", url)
    process.exit(1)
  }

  const sqlPath = path.join(__dirname, "..", "supabase", "migrations", "024_lookalike_profiles.sql")
  const query = fs.readFileSync(sqlPath, "utf8")

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  })

  const body = await res.text()
  if (!res.ok) {
    console.error("Migration failed:", res.status, body)
    process.exit(1)
  }
  console.log("Migration applied:", res.status, body || "(empty body)")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

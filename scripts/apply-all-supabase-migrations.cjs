/**
 * Applies every file in supabase/migrations/*.sql in sorted order.
 *
 * Mode A — direct Postgres (preferred when you have the DB password):
 *   Set DATABASE_URL (Session pooler or direct URI from Supabase → Project Settings → Database).
 *   Optional: place DATABASE_URL in repo-root .env (not committed).
 *
 * Mode B — Supabase Management API (no DB password; needs account token):
 *   Dashboard → Account → Access Tokens → Generate new token
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 *   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL=https://<ref>.supabase.co
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL="postgresql://..."
 *   node scripts/apply-all-supabase-migrations.cjs
 *
 * Optional: APPLY_MIGRATIONS_SKIP=1 — list migration files without executing.
 */

const fs = require("fs")
const path = require("path")

function loadEnvFile() {
  const p = path.join(__dirname, "..", ".env")
  if (!fs.existsSync(p)) return
  const text = fs.readFileSync(p, "utf8")
  for (const line of text.split(/\n/)) {
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

async function applyViaPg(databaseUrl, files, dir) {
  const { Client } = require("pg")
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()
  try {
    for (const f of files) {
      const sqlPath = path.join(dir, f)
      const query = fs.readFileSync(sqlPath, "utf8")
      if (!query.trim()) {
        console.log("Skip empty:", f)
        continue
      }
      process.stdout.write(`Applying ${f} ... `)
      await client.query("BEGIN")
      try {
        await client.query(query)
        await client.query("COMMIT")
      } catch (e) {
        await client.query("ROLLBACK")
        throw e
      }
      console.log("ok")
    }
  } finally {
    await client.end()
  }
}

async function applyViaManagementApi(token, ref, files, dir) {
  for (const f of files) {
    const sqlPath = path.join(dir, f)
    const query = fs.readFileSync(sqlPath, "utf8")
    if (!query.trim()) {
      console.log("Skip empty:", f)
      continue
    }

    process.stdout.write(`Applying ${f} ... `)
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
    console.log("ok", text ? `(${text.slice(0, 80)}…)` : "")
  }
}

async function main() {
  const skip = process.env.APPLY_MIGRATIONS_SKIP === "1"
  const dir = path.join(__dirname, "..", "supabase", "migrations")
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  console.log(`Found ${files.length} migration file(s) in ${dir}`)

  if (skip) {
    for (const f of files) console.log(" -", f)
    process.exit(0)
  }

  loadEnvFile()

  const databaseUrl = process.env.DATABASE_URL?.trim()
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()

  if (databaseUrl) {
    console.log("Using DATABASE_URL (direct Postgres).")
    await applyViaPg(databaseUrl, files, dir)
    console.log("All migrations applied successfully.")
    return
  }

  if (!url) {
    console.error(
      "Set DATABASE_URL, or set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) with SUPABASE_ACCESS_TOKEN."
    )
    process.exit(1)
  }

  const host = new URL(url).hostname
  const ref = host.replace(".supabase.co", "")
  if (!ref || ref === host) {
    console.error("Could not parse project ref from URL:", url)
    process.exit(1)
  }

  if (!token) {
    console.error(
      "Set DATABASE_URL (from Supabase → Database settings), or set SUPABASE_ACCESS_TOKEN (Account → Access Tokens)."
    )
    process.exit(1)
  }

  console.log("Using Supabase Management API.")
  await applyViaManagementApi(token, ref, files, dir)
  console.log("All migrations applied successfully.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Apply only CareerOS migrations (careeros_*.sql) in filename order.
 * Use when the remote DB has public schema but careeros was never created.
 *
 *   $env:DATABASE_URL="postgresql://..."
 *   npm run db:migrate:careeros
 *
 * Or Management API:
 *   SUPABASE_ACCESS_TOKEN + NEXT_PUBLIC_SUPABASE_URL
 */

const fs = require("fs")
const path = require("path")

function loadEnvFile(rel) {
  const p = path.join(__dirname, "..", rel)
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
      const query = fs.readFileSync(path.join(dir, f), "utf8")
      if (!query.trim()) continue
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
    const query = fs.readFileSync(path.join(dir, f), "utf8")
    if (!query.trim()) continue
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
    console.log("ok")
  }
}

async function main() {
  const dir = path.join(__dirname, "..", "supabase", "migrations")
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("careeros_") && f.endsWith(".sql"))
    .sort()
    .sort((a, b) => {
      // phase1 must run before module_1_1 (alters user_documents).
      const rank = (f) => {
        if (f.includes("phase1_foundations")) return 0
        if (f.includes("module_1_1_llm_markdown")) return 1
        return 2
      }
      const ra = rank(a)
      const rb = rank(b)
      return ra !== rb ? ra - rb : a.localeCompare(b)
    })

  if (files.length === 0) {
    console.error("No careeros_*.sql migrations found.")
    process.exit(1)
  }

  console.log(`Applying ${files.length} CareerOS migration(s)...`)
  loadEnvFile(".env")
  loadEnvFile(".env.local")
  loadEnvFile(".env.vercel.preview")

  const databaseUrl = process.env.DATABASE_URL?.trim()
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()

  if (databaseUrl) {
    await applyViaPg(databaseUrl, files, dir)
    console.log("CareerOS migrations applied.")
    return
  }

  if (!url || !token) {
    console.error(
      "Set DATABASE_URL, or SUPABASE_ACCESS_TOKEN + NEXT_PUBLIC_SUPABASE_URL, then re-run.",
    )
    process.exit(1)
  }

  const ref = new URL(url).hostname.replace(".supabase.co", "")
  await applyViaManagementApi(token, ref, files, dir)
  console.log("CareerOS migrations applied.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Apply only Creator OS migrations (creator_*.sql) in filename order,
 * then expose the creator schema to PostgREST so the app's
 * `.schema("creator")` queries work.
 *
 *   $env:DATABASE_URL="postgresql://..."
 *   npm run db:migrate:creator
 *
 * Or Management API:
 *   SUPABASE_ACCESS_TOKEN + NEXT_PUBLIC_SUPABASE_URL
 *
 * Note: pgrst.db_schemas is set as a full list, so this script names every
 * exposed schema (careeros included). Keep the list in sync with
 * scripts/careeros-expose-schema.cjs.
 */

const fs = require("fs")
const path = require("path")

const PGRST_SCHEMAS = "public, graphql_public, careeros, creator"

const EXPOSE_SQL = `
  grant usage on schema creator to anon, authenticated, service_role;
  grant select, insert, update, delete on all tables in schema creator to authenticated;
  grant select, insert, update, delete on all tables in schema creator to service_role;
  grant usage, select on all sequences in schema creator to authenticated, service_role;
  alter default privileges in schema creator
    grant select, insert, update, delete on tables to authenticated, service_role;
  alter role authenticator set pgrst.db_schemas = '${PGRST_SCHEMAS}';
  notify pgrst, 'reload config';
`

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

async function applyViaPg(databaseUrl, queries) {
  const { Client } = require("pg")
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()
  try {
    for (const { label, query } of queries) {
      if (!query.trim()) continue
      process.stdout.write(`Applying ${label} ... `)
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

async function applyViaManagementApi(token, ref, queries) {
  for (const { label, query } of queries) {
    if (!query.trim()) continue
    process.stdout.write(`Applying ${label} ... `)
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
    .filter((f) => f.startsWith("creator_") && f.endsWith(".sql"))
    .sort()

  if (files.length === 0) {
    console.error("No creator_*.sql migrations found.")
    process.exit(1)
  }

  const queries = files.map((f) => ({
    label: f,
    query: fs.readFileSync(path.join(dir, f), "utf8"),
  }))
  queries.push({ label: "expose creator schema to PostgREST", query: EXPOSE_SQL })

  console.log(`Applying ${files.length} Creator OS migration(s) + schema exposure...`)
  loadEnvFile(".env")
  loadEnvFile(".env.local")
  loadEnvFile(".env.vercel.preview")

  const databaseUrl = process.env.DATABASE_URL?.trim()
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()

  if (databaseUrl) {
    await applyViaPg(databaseUrl, queries)
    console.log("Creator OS migrations applied.")
    return
  }

  if (!url || !token) {
    console.error(
      "Set DATABASE_URL, or SUPABASE_ACCESS_TOKEN + NEXT_PUBLIC_SUPABASE_URL, then re-run.",
    )
    process.exit(1)
  }

  const ref = new URL(url).hostname.replace(".supabase.co", "")
  await applyViaManagementApi(token, ref, queries)
  console.log("Creator OS migrations applied.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Expose careeros schema to PostgREST on hosted Supabase.
 * Run: npm run careeros:expose-schema
 */
const fs = require("fs")
const path = require("path")

function loadEnvFile(rel) {
  for (const f of [rel, ".env", ".env.local", ".env.vercel.preview"]) {
    const p = path.join(__dirname, "..", f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, "utf8").split(/\n/)) {
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
}

async function runQuery(token, ref, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text}`)
  return text
}

async function main() {
  loadEnvFile(".env.vercel.preview")
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
  if (!token || !url) {
    console.error("Need SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL")
    process.exit(1)
  }
  const ref = new URL(url).hostname.replace(".supabase.co", "")

  console.log("Project:", ref)

  const current = await runQuery(
    token,
    ref,
    `select rolname, rolconfig from pg_roles where rolname in ('authenticator', 'anon', 'authenticated', 'service_role');`,
  )
  console.log("Current role config:", current)

  const exposeSql = `
    grant usage on schema careeros to anon, authenticated, service_role;
    grant select, insert, update, delete on all tables in schema careeros to authenticated;
    grant select, insert, update, delete on all tables in schema careeros to service_role;
    grant select on all tables in schema careeros to anon;
    grant usage, select on all sequences in schema careeros to authenticated, service_role;
    alter default privileges in schema careeros
      grant select, insert, update, delete on tables to authenticated, service_role;
    alter role authenticator set pgrst.db_schemas = 'public, graphql_public, careeros, creator';
    notify pgrst, 'reload config';
  `
  console.log("Applying grants + pgrst.db_schemas...")
  const result = await runQuery(token, ref, exposeSql)
  console.log("Done:", result || "ok")

  const after = await runQuery(
    token,
    ref,
    `select rolconfig from pg_roles where rolname = 'authenticator';`,
  )
  console.log("Authenticator after:", after)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})

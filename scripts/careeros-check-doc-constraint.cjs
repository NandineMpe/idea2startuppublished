const fs = require("fs")
const path = require("path")

function loadEnv() {
  for (const f of [".env.vercel.preview", ".env"]) {
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

async function main() {
  loadEnv()
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const ref = new URL(url).hostname.replace(".supabase.co", "")
  const q = `
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'careeros.user_documents'::regclass
      and contype = 'c';
  `
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: q }),
  })
  console.log(await res.text())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

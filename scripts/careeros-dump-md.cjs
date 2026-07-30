const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

function loadEnv() {
  for (const f of [".env.vercel.production"]) {
    const p = path.join(__dirname, "..", f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
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
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
  const { data: blob } = await sb.storage
    .from("careeros-documents")
    .download("961be40a-f699-468b-82ff-45d15e5eb2b4/llm_markdown/v1-eb5609c830.md")
  const text = Buffer.from(await blob.arrayBuffer()).toString("utf8")
  fs.writeFileSync(path.join(__dirname, "..", ".tmp-eleanor.md"), text)
  console.log("wrote .tmp-eleanor.md", text.length, "chars")
  console.log(text.slice(0, 2500))
}

main()

const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

function loadEnv() {
  for (const f of [".env.vercel.production", ".env.vercel.preview"]) {
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
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const docs = await sb
    .schema("careeros")
    .from("user_documents")
    .select("id,user_id,doc_type,version,storage_path,text_hash,created_at")
    .eq("doc_type", "llm_markdown")
    .order("created_at", { ascending: false })
    .limit(15)

  console.log("user_documents:", docs.error?.message || docs.data)

  const ext = await sb
    .schema("careeros")
    .from("user_document_extractions")
    .select("id,user_document_id,parser_name,extraction_version,is_current,created_at")
    .eq("parser_name", "careeros-onboarding")
    .order("created_at", { ascending: false })
    .limit(15)

  console.log("extractions:", ext.error?.message || ext.data)

  const { data: list, error: listErr } = await sb.storage
    .from("careeros-documents")
    .list("", { limit: 5, sortBy: { column: "created_at", order: "desc" } })

  console.log("storage root list:", listErr?.message || list?.slice(0, 3))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

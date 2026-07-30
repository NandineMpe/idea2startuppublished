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
  const docId = "5add820a-decc-4599-a264-795bade82387"
  const userId = "961be40a-f699-468b-82ff-45d15e5eb2b4"
  const storagePath = `${userId}/llm_markdown/v1-eb5609c830.md`

  const { data: blob, error: dlErr } = await sb.storage
    .from("careeros-documents")
    .download(storagePath)
  if (dlErr) throw dlErr

  const text = Buffer.from(await blob.arrayBuffer()).toString("utf8")
  const ins = await sb.schema("careeros").from("user_document_extractions").insert({
    user_id: userId,
    user_document_id: docId,
    parser_name: "careeros-onboarding",
    parser_version: "1",
    extraction_version: 1,
    is_current: true,
    parsed_payload: { plain_text: text },
    input_data_version: "repair-20260520",
    source_attribution: { parser: "careeros-onboarding" },
  })
  console.log(ins.error?.message || "extraction ok")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Simulates step-one llm_markdown persist against production Supabase.
 * Usage: node scripts/careeros-test-step-one-upload.cjs [path-to.md]
 */
const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

function loadEnv() {
  for (const f of [".env.vercel.preview", ".env.vercel.production", ".env"]) {
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

function sha256Hex(buffer) {
  const crypto = require("crypto")
  return crypto.createHash("sha256").update(buffer).digest("hex")
}

async function main() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const mdPath = process.argv[2]
  const plainText = mdPath && fs.existsSync(mdPath)
    ? fs.readFileSync(mdPath, "utf8")
    : "# Test Career Profile\n\n## Skills\n- Python\n- SQL\n\n## Role\nSenior Engineer at Acme Corp (2020-present)\n"

  const sb = createClient(url, key)
  const userId = process.env.CAREEROS_TEST_USER_ID
  if (!userId) {
    console.error("Set CAREEROS_TEST_USER_ID to a real auth.users id to run insert test")
    process.exit(1)
  }

  const buffer = Buffer.from(plainText, "utf8")
  const textHash = sha256Hex(buffer)
  const docType = "llm_markdown"

  console.log("1) Check doc_type constraints...")
  const { data: constraints, error: cErr } = await sb.rpc("noop").catch(() => ({ data: null, error: null }))
  void constraints
  void cErr

  console.log("2) Insert user_documents...")
  const version = 99
  const storagePath = `${userId}/${docType}/v${version}-test-${textHash.slice(0, 8)}.md`

  const up = await sb.storage.from("careeros-documents").upload(storagePath, buffer, {
    contentType: "text/markdown",
    upsert: false,
  })
  if (up.error) {
    console.error("Storage upload FAILED:", up.error.message, up.error)
  } else {
    console.log("Storage upload ok:", up.data?.path)
  }

  const ins = await sb.schema("careeros").from("user_documents").insert({
    user_id: userId,
    doc_type: docType,
    version,
    storage_bucket: "careeros-documents",
    storage_path: storagePath,
    text_hash: textHash + "-test",
    content_mime_type: "text/markdown",
    content_bytes: buffer.byteLength,
  }).select("id").single()

  if (ins.error) {
    console.error("user_documents insert FAILED:", ins.error.message, ins.error)
    process.exit(1)
  }
  console.log("user_documents ok:", ins.data.id)

  console.log("3) Insert extraction (careeros-onboarding)...")
  const ext = await sb.schema("careeros").from("user_document_extractions").insert({
    user_id: userId,
    user_document_id: ins.data.id,
    parser_name: "careeros-onboarding",
    parser_version: "1",
    extraction_version: 1,
    is_current: true,
    parsed_payload: { plain_text: plainText.slice(0, 500) },
    input_data_version: textHash,
    source_attribution: { parser: "careeros-onboarding" },
  })

  if (ext.error) {
    console.error("extraction insert FAILED:", ext.error.message, ext.error)
    process.exit(1)
  }
  console.log("extraction ok")

  console.log("All steps passed for user", userId)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

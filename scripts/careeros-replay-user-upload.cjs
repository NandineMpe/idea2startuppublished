/**
 * Replay llm_markdown persist for a user using an orphaned storage object.
 */
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
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

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex")
}

async function main() {
  loadEnv()
  const userId = "961be40a-f699-468b-82ff-45d15e5eb2b4"
  const storagePath = `${userId}/llm_markdown/v1-eb5609c830.md`
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const { data: blob, error: dlErr } = await sb.storage
    .from("careeros-documents")
    .download(storagePath)
  if (dlErr) {
    console.error("download failed", dlErr.message)
    process.exit(1)
  }
  const buffer = Buffer.from(await blob.arrayBuffer())
  const textHash = sha256Hex(buffer)
  const version = 1
  const pathForInsert = `${userId}/llm_markdown/v${version}-${textHash.slice(0, 10)}.md`
  console.log("hash prefix", textHash.slice(0, 10), "insert path", pathForInsert)

  const up1 = await sb.storage.from("careeros-documents").upload(pathForInsert, buffer, {
    contentType: "text/markdown",
    upsert: false,
  })
  console.log("upload upsert:false", up1.error?.message || "ok")

  const up2 = await sb.storage.from("careeros-documents").upload(pathForInsert, buffer, {
    contentType: "text/markdown",
    upsert: true,
  })
  console.log("upload upsert:true", up2.error?.message || "ok")

  const ins = await sb.schema("careeros").from("user_documents").insert({
    user_id: userId,
    doc_type: "llm_markdown",
    version,
    storage_bucket: "careeros-documents",
    storage_path: pathForInsert,
    text_hash: textHash,
    content_mime_type: "text/markdown",
    content_bytes: buffer.byteLength,
  }).select("id").single()
  console.log("user_documents", ins.error?.message || ins.data?.id)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

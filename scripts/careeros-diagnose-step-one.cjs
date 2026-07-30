/**
 * Diagnose step-one persist path against production Supabase.
 * Usage: node scripts/careeros-diagnose-step-one.cjs
 */
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { createClient } = require("@supabase/supabase-js")

function loadEnv() {
  for (const f of [".env.vercel.production", ".env.vercel.preview", ".env"]) {
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }
  console.log("env ok", { url: url.slice(0, 30) + "...", serviceRoleLen: key.length })

  const sb = createClient(url, key)

  const { data: profiles, error: pErr } = await sb
    .schema("careeros")
    .from("user_profiles")
    .select("user_id")
    .limit(1)
  if (pErr) {
    console.error("user_profiles read failed:", pErr.message, pErr)
    process.exit(1)
  }
  const userId = profiles?.[0]?.user_id
  if (!userId) {
    console.error("No careeros user_profiles rows found")
    process.exit(1)
  }
  console.log("test user_id", userId)

  const plainText =
    "# Diagnose Career Profile\n\n## Skills\n- Python\n- SQL\n\n## Role\nEngineer at Test Corp\n"
  const buffer = Buffer.from(plainText, "utf8")
  const textHash = sha256Hex(buffer)
  const docType = "llm_markdown"

  const { data: versionRow } = await sb
    .schema("careeros")
    .from("user_documents")
    .select("version")
    .eq("user_id", userId)
    .eq("doc_type", docType)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  const version = ((versionRow?.version ?? 0) + 1)
  const storagePath = `${userId}/${docType}/v${version}-diag-${textHash.slice(0, 8)}.md`

  console.log("1) storage upload...")
  const up = await sb.storage.from("careeros-documents").upload(storagePath, buffer, {
    contentType: "text/markdown",
    upsert: false,
  })
  if (up.error) {
    console.error("FAIL storage:", up.error.message, up.error)
    process.exit(1)
  }
  console.log("   ok", up.data?.path)

  console.log("2) user_documents insert llm_markdown...")
  const ins = await sb
    .schema("careeros")
    .from("user_documents")
    .insert({
      user_id: userId,
      doc_type: docType,
      version,
      storage_bucket: "careeros-documents",
      storage_path: storagePath,
      text_hash: textHash + "-diag-" + Date.now(),
      content_mime_type: "text/markdown",
      content_bytes: buffer.byteLength,
    })
    .select("id")
    .single()
  if (ins.error) {
    console.error("FAIL user_documents:", ins.error.message, ins.error)
    process.exit(1)
  }
  console.log("   ok", ins.data.id)

  console.log("3) extraction insert (careeros-onboarding)...")
  const ext = await sb.schema("careeros").from("user_document_extractions").insert({
    user_id: userId,
    user_document_id: ins.data.id,
    parser_name: "careeros-onboarding",
    parser_version: "1",
    extraction_version: 1,
    is_current: true,
    parsed_payload: { plain_text: plainText },
    input_data_version: textHash,
    source_attribution: { parser: "careeros-onboarding" },
  })
  if (ext.error) {
    console.error("FAIL extraction:", ext.error.message, ext.error)
    process.exit(1)
  }
  console.log("   ok")

  console.log("4) user_settings upsert with large markdown in onboarding_state...")
  const big = plainText.repeat(800)
  const { error: settingsErr } = await sb.schema("careeros").from("user_settings").upsert(
    {
      user_id: userId,
      notification_preferences: {},
      privacy_preferences: {},
      onboarding_state: {
        module_1_1: {
          step1CompletedAt: new Date().toISOString(),
          latestLlmMarkdownText: big,
          latestLlmMarkdownSourceLabel: "diag",
        },
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )
  if (settingsErr) {
    console.error("FAIL user_settings:", settingsErr.message, settingsErr)
  } else {
    console.log("   ok (chars in state:", big.length, ")")
  }

  console.log("\nAll diagnose steps passed.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

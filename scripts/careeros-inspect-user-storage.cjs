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

async function listAll(sb, prefix) {
  const { data, error } = await sb.storage.from("careeros-documents").list(prefix, {
    limit: 100,
  })
  if (error) {
    console.log("list error", prefix, error.message)
    return
  }
  for (const item of data ?? []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id === null) {
      await listAll(sb, full)
    } else {
      console.log("  file:", full, item.metadata)
    }
  }
}

async function main() {
  loadEnv()
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  for (const userId of [
    "961be40a-f699-468b-82ff-45d15e5eb2b4",
    "e909b041-e338-4ad5-a515-a1bcc6d2e9b3",
  ]) {
    console.log("\n=== user", userId, "===")
    const docs = await sb
      .schema("careeros")
      .from("user_documents")
      .select("id,doc_type,version,storage_path,text_hash,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
    console.log("DB docs:", docs.error?.message || docs.data)

    console.log("Storage tree:")
    await listAll(sb, userId)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

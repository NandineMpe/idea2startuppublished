/**
 * Test profile extraction LLM call with user's markdown from storage.
 * Usage: node scripts/careeros-test-qwen-extract.cjs
 */
const fs = require("fs")
const path = require("path")

function loadEnv() {
  for (const f of [".env.vercel.production", ".env.local", ".env"]) {
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
  const { createClient } = require("@supabase/supabase-js")
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
  const userId = "961be40a-f699-468b-82ff-45d15e5eb2b4"
  const { data: blob } = await sb.storage
    .from("careeros-documents")
    .download(`${userId}/llm_markdown/v1-eb5609c830.md`)
  const llmMarkdownText = Buffer.from(await blob.arrayBuffer()).toString("utf8")
  console.log("markdown chars:", llmMarkdownText.length)

  // Dynamic import TS modules via tsx if available, else use child process
  const { spawnSync } = require("child_process")
  const tmp = path.join(__dirname, "..", ".tmp-extract-test.mjs")
  fs.writeFileSync(
    tmp,
    `
import { qwenGenerateObject } from "./lib/careeros/ai/qwen.ts"
import { ProfileExtractionSchema } from "./lib/careeros/schemas/profile-extraction.v1.ts"
import { PROFILE_EXTRACT_SYSTEM_PROMPT, buildProfileExtractUserPrompt } from "./lib/careeros/prompts/profile-extract.v1.ts"

const userPrompt = buildProfileExtractUserPrompt({
  resumeText: null,
  linkedinText: null,
  llmMarkdownText: process.env.TEST_MD,
  userStatedRole: "3 PQE Solicitor",
  userStatedYearsExperience: 3,
})
try {
  const result = await qwenGenerateObject({
    schema: ProfileExtractionSchema,
    systemPrompt: PROFILE_EXTRACT_SYSTEM_PROMPT,
    userPrompt,
  })
  console.log("OK skills:", result.object.skills?.length, "roles:", result.object.past_roles?.length)
  console.log("sample:", JSON.stringify(result.object.skills?.slice(0,3), null, 2))
} catch (e) {
  console.error("FAIL:", e instanceof Error ? e.message : e)
  if (e?.cause) console.error("cause:", e.cause)
  process.exit(1)
}
`,
  )

  const r = spawnSync("npx", ["tsx", tmp], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, TEST_MD: llmMarkdownText },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })
  console.log(r.stdout)
  if (r.stderr) console.error(r.stderr)
  process.exit(r.status ?? 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

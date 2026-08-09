/**
 * Run synthesis for one creator and report the slate by move.
 *
 *   npx tsx scripts/creator-synthesise.ts <user_id>
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

for (const file of [".env", ".env.local", ".env.vercel.production", ".env.vercel.preview"]) {
  config({ path: file, override: false })
}

async function main() {
  const userId = process.argv[2]
  if (!userId) {
    console.error("Usage: npx tsx scripts/creator-synthesise.ts <user_id>")
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const before = new Date().toISOString()
  const { synthesiseStoriesForUser } = await import("../lib/creator/research/synthesise")
  const result = await synthesiseStoriesForUser(supabase, userId)
  console.log(JSON.stringify(result), "\n")

  const { data } = await supabase
    .schema("creator")
    .from("creator_stories")
    .select(
      "thesis,move,synthesis_kind,state,hook_line,named_actor,stakes,open_question,unknowns,kill_reason,primary_emotion,output_format,gate_failure",
    )
    .eq("user_id", userId)
    .gte("created_at", before)
    .order("created_at", { ascending: false })

  for (const s of data ?? []) {
    console.log(
      `[${s.move}/${s.synthesis_kind}/${s.state}/${s.primary_emotion}/${s.output_format}] ${s.thesis}`,
    )
    console.log(`    hook:   ${s.hook_line}`)
    console.log(`    actor:  ${s.named_actor}`)
    console.log(`    stakes: ${s.stakes}`)
    console.log(`    open:   ${s.open_question}`)
    console.log(`    unknown:${s.unknowns}`)
    console.log(`    kill:   ${s.kill_reason}`)
    if (s.gate_failure) console.log(`    GATED:  ${s.gate_failure}`)
    console.log()
  }

  const counts = (data ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.move] = (acc[s.move] ?? 0) + 1
    return acc
  }, {})
  console.log("slate by move:", JSON.stringify(counts))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

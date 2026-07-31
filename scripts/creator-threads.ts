/**
 * Open threads from the corpus, and check the ones that are due.
 *
 *   npx tsx scripts/creator-threads.ts <user_id> open
 *   npx tsx scripts/creator-threads.ts <user_id> check [limit]
 *   npx tsx scripts/creator-threads.ts <user_id> list
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

for (const file of [".env", ".env.local", ".env.vercel.production", ".env.vercel.preview"]) {
  config({ path: file, override: false })
}

async function main() {
  const userId = process.argv[2]
  const mode = process.argv[3] ?? "list"
  if (!userId) {
    console.error("Usage: npx tsx scripts/creator-threads.ts <user_id> open|check|list")
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  if (mode === "open") {
    const { openThreadsFromCorpus } = await import("../lib/creator/threads/open")
    const result = await openThreadsFromCorpus(supabase, userId)
    console.log(JSON.stringify(result))
  }

  if (mode === "check") {
    const { checkThread, loadDueThreads } = await import("../lib/creator/threads/check")
    const limit = Number(process.argv[4] ?? 4)
    const due = await loadDueThreads(supabase, userId, limit)
    console.log(`${due.length} thread(s) due\n`)
    for (const thread of due) {
      const started = Date.now()
      const result = await checkThread(supabase, userId, thread)
      console.log(`— ${thread.subject}`)
      console.log(`  anchored ${thread.anchor_date.slice(0, 10)} · ${JSON.stringify(result)} · ${Date.now() - started}ms`)
    }
  }

  const { data } = await supabase
    .schema("creator")
    .from("creator_threads")
    .select("subject,query,anchor_date,state,check_count,developments,open_questions")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("anchor_date", { ascending: true })

  console.log(`\n=== ${(data ?? []).length} THREADS ===`)
  for (const t of data ?? []) {
    console.log(`\n[${t.state}] ${t.subject}`)
    console.log(`  anchored: ${t.anchor_date.slice(0, 10)} · checks: ${t.check_count}`)
    console.log(`  query: ${t.query}`)
    console.log(`  open: ${(t.open_questions ?? []).join(" | ")}`)
    const devs = (t.developments ?? []) as Array<{
      moved: boolean
      significance: string
      summary: string
      receipts: Array<{ title: string; url: string; published_at: string; quote: string }>
    }>
    for (const d of devs) {
      console.log(`  → [${d.significance}] ${d.summary}`)
      for (const r of (d.receipts ?? []).slice(0, 3)) {
        console.log(`      ${r.published_at.slice(0, 10)} ${r.title.slice(0, 80)}`)
        console.log(`         "${(r.quote ?? "").slice(0, 160)}"`)
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

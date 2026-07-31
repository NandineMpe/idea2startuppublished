/**
 * Page the whole feed with the cursor and assert it is complete.
 *
 * Cursor pagination fails quietly: a wrong comparison skips or repeats rows and
 * the screen still looks fine, because nobody knows what should have been
 * there. This walks every page and checks the set against a straight count.
 *
 *   npx tsx scripts/creator-feed-check.ts <user_id> [filter]
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

for (const file of [".env", ".env.local", ".env.vercel.production", ".env.vercel.preview"]) {
  config({ path: file, override: false })
}

async function main() {
  const userId = process.argv[2]
  const filter = (process.argv[3] ?? "all") as "all" | "primary" | "considered" | "unseen" | "used"
  if (!userId) {
    console.error("Usage: npx tsx scripts/creator-feed-check.ts <user_id> [filter]")
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { loadFeedPage, loadFeedCounts } = await import("../lib/creator/load-feed")

  const counts = await loadFeedCounts(supabase, userId)
  console.log("counts:", JSON.stringify(counts))

  const seen = new Set<string>()
  let duplicates = 0
  let cursor: string | null = null
  let pages = 0
  let lastIngested = ""

  for (;;) {
    const page = await loadFeedPage(supabase, userId, { filter, cursor })
    pages++
    for (const s of page.signals) {
      if (seen.has(s.id)) duplicates++
      seen.add(s.id)
      // Ordering must be non-increasing across the whole walk, not just inside
      // a page: a cursor that resets ordering is the classic silent failure.
      if (lastIngested && s.ingested_at > lastIngested) {
        console.error(`ORDER BROKEN at ${s.id}: ${s.ingested_at} > ${lastIngested}`)
      }
      lastIngested = s.ingested_at
    }
    if (!page.cursor) break
    cursor = page.cursor
    if (pages > 100) {
      console.error("Aborting: more than 100 pages, cursor is probably not advancing")
      break
    }
  }

  console.log(`filter=${filter}: walked ${pages} page(s), ${seen.size} unique, ${duplicates} duplicate(s)`)

  const { count } = await supabase
    .schema("creator")
    .from("creator_signals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)

  if (filter === "all") {
    console.log(`table has ${count}; feed walked ${seen.size} — ${count === seen.size ? "COMPLETE" : "MISMATCH"}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

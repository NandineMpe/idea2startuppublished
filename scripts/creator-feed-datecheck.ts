/**
 * Verify date-filtered feed pagination against ground truth.
 *
 * The failure mode is silent: a wrong bound, or a cursor that ignores the
 * range, hides documents while the screen still looks plausible. This walks
 * every page of several ranges and compares the resulting set against a
 * straight count.
 *
 *   npx tsx scripts/creator-feed-datecheck.ts <user_id>
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

for (const f of [".env", ".env.local", ".env.vercel.production", ".env.vercel.preview"]) {
  config({ path: f, override: false })
}

type Range = { field: "published" | "collected"; from: string | null; to: string | null }

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
}

async function main() {
  const userId = process.argv[2]
  if (!userId) {
    console.error("Usage: npx tsx scripts/creator-feed-datecheck.ts <user_id>")
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { loadFeedPage } = await import("../lib/creator/load-feed")

  async function walk(range: Range) {
    const seen = new Set<string>()
    let cursor: string | null = null
    let pages = 0
    let oldest = "9999"
    let newest = "0000"

    for (;;) {
      const p = await loadFeedPage(supabase, userId, { filter: "all", cursor, range })
      pages++
      for (const s of p.signals) {
        seen.add(s.id)
        const d = (range.field === "collected" ? s.ingested_at : s.published_at) ?? ""
        if (d && d < oldest) oldest = d
        if (d && d > newest) newest = d
      }
      if (!p.cursor) break
      cursor = p.cursor
      if (pages > 60) {
        console.error("cursor not advancing")
        break
      }
    }
    return { count: seen.size, pages, oldest: oldest.slice(0, 10), newest: newest.slice(0, 10) }
  }

  async function truth(range: Range) {
    const col = range.field === "collected" ? "ingested_at" : "published_at"
    let q = supabase
      .schema("creator")
      .from("creator_signals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
    if (range.from) q = q.gte(col, `${range.from}T00:00:00.000Z`)
    if (range.to) q = q.lte(col, `${range.to}T23:59:59.999Z`)
    const { count } = await q
    return count ?? 0
  }

  const cases: Array<[string, Range]> = [
    ["published, last 7d", { field: "published", from: daysAgo(7), to: null }],
    ["published, last 90d", { field: "published", from: daysAgo(90), to: null }],
    ["collected, today", { field: "collected", from: daysAgo(0), to: null }],
    ["published, 2025 only", { field: "published", from: "2025-01-01", to: "2025-12-31" }],
    ["published, single day", { field: "published", from: daysAgo(1), to: daysAgo(1) }],
  ]

  for (const [label, range] of cases) {
    const walked = await walk(range)
    const expected = await truth(range)
    const ok = walked.count === expected ? "OK" : "MISMATCH"
    console.log(
      `${label.padEnd(22)} walked ${String(walked.count).padStart(3)} / expected ${String(expected).padStart(3)}  ${ok}  pages=${walked.pages}  range=${walked.oldest}..${walked.newest}`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Hunt opportunities and print who each one says to contact.
 *
 * The check that matters is not that a counterparty came back: it is that the
 * route is a URL the agent was actually shown. A constructed contact address is
 * the outreach version of a fabricated citation.
 *
 *   npx tsx scripts/creator-opportunities.ts <user_id>
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

for (const f of [".env", ".env.local", ".env.vercel.production", ".env.vercel.preview"]) {
  config({ path: f, override: false })
}

async function main() {
  const userId = process.argv[2]
  if (!userId) {
    console.error("Usage: npx tsx scripts/creator-opportunities.ts <user_id>")
    process.exit(1)
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { loadResearchTopics } = await import("../lib/creator/research/sweep")
  const { sweepOpportunitiesForUser } = await import("../lib/creator/opportunities/sweep")
  const topics = await loadResearchTopics(supabase, userId)
  const started = new Date().toISOString()

  const result = await sweepOpportunitiesForUser(supabase, userId, topics.core, topics.horizon)
  console.log(JSON.stringify(result), "\n")

  const { data } = await supabase
    .schema("creator")
    .from("creator_work")
    .select("title,kind,counterparty,provenance")
    .eq("user_id", userId)
    .in("kind", ["deal", "event"])
    .gte("created_at", started)

  let missing = 0
  for (const row of data ?? []) {
    const c = row.counterparty as Record<string, string> | null
    console.log(`\n[${row.kind}] ${row.title}`)
    if (!c) {
      missing++
      console.log("   NO COUNTERPARTY")
      continue
    }
    console.log(`   org:    ${c.organisation}`)
    console.log(`   desk:   ${c.contact_role}${c.contact_name ? ` — ${c.contact_name}` : ""} [${c.confidence}]`)
    console.log(`   do:     ${c.next_action}`)
    console.log(`   route:  ${c.contact_route || "(none survived the guard)"}`)
  }
  console.log(`\n${(data ?? []).length} opportunities, ${missing} without a counterparty`)
}

main().catch((e) => { console.error(e); process.exit(1) })

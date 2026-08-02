/**
 * Draft from a story and print what the queue card will actually show.
 *
 * The bug this guards against is a silent one: the draft is written fine, and
 * the receipts and lineage simply do not travel with it, so the queue looks
 * complete while the evidence is one screen away.
 *
 *   npx tsx scripts/creator-draft.ts <user_id> [story_id]
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

for (const f of [".env", ".env.local", ".env.vercel.production", ".env.vercel.preview"]) {
  config({ path: f, override: false })
}

async function main() {
  const userId = process.argv[2]
  if (!userId) {
    console.error("Usage: npx tsx scripts/creator-draft.ts <user_id> [story_id]")
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  let storyId = process.argv[3]
  if (!storyId) {
    // Prefer a story that already has a lineage, so the carry-through is
    // actually exercised rather than trivially passing on a null.
    const { data } = await supabase
      .schema("creator")
      .from("creator_stories")
      .select("id,thesis,lineage_state")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("state", "proposed")
      .order("lineage_state", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) {
      console.error("No proposed story to draft from.")
      process.exit(1)
    }
    storyId = data.id
    console.log(`Drafting from: ${data.thesis.slice(0, 100)} (lineage: ${data.lineage_state})\n`)
  }

  const { draftForUser } = await import("../lib/creator/writer/draft")
  const result = await draftForUser(supabase, userId, { storyId })
  if (!result) {
    console.error("Writer returned nothing.")
    process.exit(1)
  }

  const { loadCreatorDrafts } = await import("../lib/creator/load-next-five")
  const drafts = await loadCreatorDrafts(supabase, userId, 3)
  const draft = drafts.find((d) => d.id === result.work_id) ?? drafts[0]

  console.log("=== CARD ===")
  console.log("title:   ", draft.title)
  console.log("premise: ", draft.premise ?? "(none)")
  console.log("hook:    ", draft.hook ?? "(none)")

  const sections = draft.script_sections
  if (!sections) {
    console.log("\nSECTIONS: NONE — the house structure did not survive")
  } else {
    for (const k of ["point", "trigger", "analysis", "loop"] as const) {
      console.log(`\n--- ${k.toUpperCase()} ---`)
      console.log(sections[k])
    }

    // The seam is the only part of the structure that can be checked by
    // reading it: the loop either runs into the opening or it does not.
    const seamOut = sections.loop.trim().split(/\s+/).slice(-14).join(" ")
    const seamIn = sections.point.trim().split(/\s+/).slice(0, 14).join(" ")
    console.log("\n=== THE SEAM (end of loop -> start of point) ===")
    console.log(`...${seamOut}  ||  ${seamIn}...`)

    const hookIsOpening = Boolean(draft.hook && sections.point.trim().startsWith(draft.hook.trim()))
    console.log(`\nhook is the literal opening line: ${hookIsOpening ? "YES" : "NO"}`)
  }
  console.log("\n=== CARRIED THROUGH ===")
  if (!draft.source) {
    console.log("source:   NONE — the link back to the story was lost")
  } else {
    console.log("thesis:  ", draft.source.thesis.slice(0, 120))
    console.log("move:    ", draft.source.move)
    console.log("why_now: ", draft.source.why_now?.slice(0, 120) ?? "(none)")
    console.log("receipts:", draft.source.receipts.length)
    for (const r of draft.source.receipts.slice(0, 3)) {
      console.log(`   "${(r.quote ?? "").slice(0, 90)}"`)
      console.log(`    ${r.url ?? "(no url)"}`)
    }
    console.log("lineage: ", draft.source.lineage_state, draft.source.lineage?.timeline?.length ?? 0, "moments")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

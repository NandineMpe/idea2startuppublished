/**
 * Plan visuals for the newest draft and print the shot list.
 *
 * The check that matters is not that a plan came back: it is that every
 * document capture points at a URL the story actually cites. A plausible plan
 * built on an invented source sends the creator hunting for a page that does
 * not exist, or worse, films the wrong one as evidence.
 *
 *   npx tsx scripts/creator-visuals.ts <user_id> [work_id]
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

for (const f of [".env", ".env.local", ".env.vercel.production", ".env.vercel.preview"]) {
  config({ path: f, override: false })
}

async function main() {
  const userId = process.argv[2]
  if (!userId) {
    console.error("Usage: npx tsx scripts/creator-visuals.ts <user_id> [work_id]")
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  let workId = process.argv[3]
  if (!workId) {
    const { data } = await supabase
      .schema("creator")
      .from("creator_work")
      .select("id,title")
      .eq("user_id", userId)
      .eq("kind", "draft")
      .is("deleted_at", null)
      .not("body", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) {
      console.error("No draft to plan.")
      process.exit(1)
    }
    workId = data.id
    console.log(`Planning: ${data.title}\n`)
  }

  const { planVisualsForDraft } = await import("../lib/creator/visuals/plan")
  const result = await planVisualsForDraft(supabase, userId, workId)
  if (!result.ok) {
    console.error("FAILED:", result.error)
    process.exit(1)
  }

  const { data: row } = await supabase
    .schema("creator")
    .from("creator_work")
    .select("visual_plan,provenance")
    .eq("id", workId)
    .maybeSingle()

  const plan = row?.visual_plan as {
    cover_text: string
    cover_concept: string
    shots: Array<{ seconds: number; asset_type: string; on_screen_text: string; visual: string; source_url: string; tool: string }>
    captures: Array<{ url: string; highlight: string }>
    motif: string
    sound: string
  }

  console.log(`FIRST FRAME: "${plan.cover_text}"`)
  console.log(`             ${plan.cover_concept}\n`)

  for (const s of plan.shots) {
    console.log(`${String(s.seconds).padStart(2)}s [${s.asset_type}] ${s.tool}`)
    if (s.on_screen_text) console.log(`    text: "${s.on_screen_text}"`)
    console.log(`    ${s.visual.slice(0, 150)}`)
    if (s.source_url) console.log(`    src: ${s.source_url.slice(0, 100)}`)
  }

  console.log(`\nCAPTURES (${plan.captures.length}):`)
  for (const c of plan.captures) console.log(`  ${c.url}\n    highlight: ${c.highlight}`)

  console.log(`\nMOTIF: ${plan.motif}`)
  console.log(`SOUND: ${plan.sound}`)

  // The integrity check. Every cited URL must be one the story actually carries.
  const storyId = (row?.provenance as { story_id?: string } | null)?.story_id
  if (storyId) {
    const { data: story } = await supabase
      .schema("creator")
      .from("creator_stories")
      .select("receipts")
      .eq("id", storyId)
      .maybeSingle()
    const allowed = new Set(
      ((story?.receipts ?? []) as Array<{ url?: string }>).map((r) => r.url).filter(Boolean),
    )
    const cited = [
      ...plan.shots.map((s) => s.source_url).filter(Boolean),
      ...plan.captures.map((c) => c.url),
    ]
    const invented = cited.filter((u) => !allowed.has(u))
    console.log(
      `\nINTEGRITY: ${cited.length} cited, ${allowed.size} available, ${invented.length} invented ${invented.length === 0 ? "OK" : "FAIL"}`,
    )
    for (const u of invented) console.log(`  INVENTED: ${u}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

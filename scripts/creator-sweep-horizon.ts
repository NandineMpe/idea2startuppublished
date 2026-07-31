/**
 * Sweep the creator's horizon territory and report what each query returned.
 *
 *   npx tsx scripts/creator-sweep-horizon.ts <user_id> [hours_back]
 *
 * Verifies the part of the trajectory change that matters: whether declaring a
 * destination actually changes what the Researcher reads, rather than only what
 * the prompts say about it.
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

for (const file of [".env", ".env.local", ".env.vercel.production", ".env.vercel.preview"]) {
  config({ path: file, override: false })
}

async function main() {
  const userId = process.argv[2]
  const hoursBack = Number(process.argv[3] ?? 168)
  if (!userId) {
    console.error("Usage: npx tsx scripts/creator-sweep-horizon.ts <user_id> [hours_back]")
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { loadResearchTopics, sweepOneTopic } = await import("../lib/creator/research/sweep")
  const topics = await loadResearchTopics(supabase, userId)

  console.log(
    `core=${topics.core.length} adjacent=${topics.adjacent.length} horizon=${topics.horizon.length}\n`,
  )
  if (!topics.horizon.length) {
    console.error("No horizon topics. Derive the strategy first.")
    process.exit(1)
  }

  let total = 0
  for (const topic of topics.horizon) {
    const outcome = await sweepOneTopic(supabase, userId, topic, "horizon", hoursBack)
    total += outcome.upserted
    const lanes = Object.entries(outcome.by_lane)
      .map(([lane, n]) => `${lane}:${n}`)
      .join(" ")
    console.log(
      `"${topic}"\n    fetched ${outcome.fetched}, new ${outcome.upserted}  [${lanes || "nothing"}]${
        outcome.errors.length ? `\n    errors: ${outcome.errors.join(" | ")}` : ""
      }`,
    )
  }

  console.log(`\nTotal new horizon signals: ${total}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

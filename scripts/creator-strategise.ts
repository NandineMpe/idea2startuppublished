/**
 * Run the strategist for one creator from the command line.
 *
 * The screen runs this inline behind an authenticated session; this is the same
 * pass with the service role, for verifying a change without a browser.
 *
 *   npx tsx scripts/creator-strategise.ts <user_id>
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

// .env holds the app keys; the Vercel pulls carry the service role key.
for (const file of [".env", ".env.local", ".env.vercel.production", ".env.vercel.preview"]) {
  config({ path: file, override: false })
}

async function main() {
  const userId = process.argv[2]
  if (!userId) {
    console.error("Usage: npx tsx scripts/creator-strategise.ts <user_id>")
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { strategiseTrajectory } = await import("../lib/creator/trajectory/strategise")
  const result = await strategiseTrajectory(supabase, userId)

  if (!result.ok) {
    console.error("FAILED:", result.error)
    process.exit(1)
  }

  console.log(
    `Strategy derived: ${result.gaps} gaps, ${result.phases} phases, ${result.territory} search queries, ${result.tokens} tokens.`,
  )

  const { data } = await supabase
    .schema("creator")
    .from("creator_trajectory")
    .select("position_now,gaps,sequence,stop_doing,rooms,proof_needed,search_territory")
    .eq("user_id", userId)
    .maybeSingle()

  console.log("\n--- WHERE THEY STAND ---\n" + data?.position_now)
  console.log("\n--- STOP DOING ---\n" + (data?.stop_doing ?? []).map((s: string) => `- ${s}`).join("\n"))
  console.log(
    "\n--- GAPS ---\n" +
      (data?.gaps ?? [])
        .map((g: { gap: string; closes_with: string }) => `- ${g.gap}\n    closes with: ${g.closes_with}`)
        .join("\n"),
  )
  console.log(
    "\n--- SEQUENCE ---\n" +
      (data?.sequence ?? [])
        .map(
          (p: { phase: string; months: string; objective: string; plays: string[] }) =>
            `${p.phase} (${p.months}): ${p.objective}\n    ${p.plays.join("\n    ")}`,
        )
        .join("\n"),
  )
  console.log("\n--- ROOMS ---\n" + (data?.rooms ?? []).map((s: string) => `- ${s}`).join("\n"))
  console.log("\n--- PROOF NEEDED ---\n" + (data?.proof_needed ?? []).map((s: string) => `- ${s}`).join("\n"))
  console.log("\n--- SEARCH TERRITORY ---\n" + (data?.search_territory ?? []).map((s: string) => `- ${s}`).join("\n"))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

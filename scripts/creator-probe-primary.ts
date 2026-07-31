/**
 * Probe each primary-source adapter against a real query and report what came
 * back. Run before wiring a lane into the sweep, and after changing one.
 *
 *   npx tsx scripts/creator-probe-primary.ts "PCAOB inspection findings artificial intelligence"
 */
import { config } from "dotenv"

for (const file of [".env", ".env.local", ".env.vercel.production", ".env.vercel.preview"]) {
  config({ path: file, override: false })
}

async function main() {
  const topic = process.argv[2] ?? "artificial intelligence audit evidence"
  const hoursBack = Number(process.argv[3] ?? 24 * 90)

  const { PRIMARY_ADAPTERS } = await import("../lib/creator/research/primary")

  for (const [lane, fn] of Object.entries(PRIMARY_ADAPTERS)) {
    const started = Date.now()
    try {
      const items = await fn(topic, hoursBack)
      console.log(`\n=== ${lane} — ${items.length} items in ${Date.now() - started}ms ===`)
      for (const item of items.slice(0, 3)) {
        console.log(`  ${item.published_at.toISOString().slice(0, 10)} ${item.title.slice(0, 95)}`)
        console.log(`      ${item.url}`)
        if (item.body) console.log(`      ${item.body.replace(/\s+/g, " ").slice(0, 150)}`)
      }
    } catch (e) {
      console.log(`\n=== ${lane} — FAILED: ${e instanceof Error ? e.message : e} ===`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

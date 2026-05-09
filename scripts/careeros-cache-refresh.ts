import { sendCareerOSEvent } from "../lib/careeros/inngest/client"

/**
 * Manual trigger for `careeros-market-cache-refresh` via Inngest Cloud.
 * Optional CLI args become `onetKeywords`; omit args to use workflow defaults.
 *
 * Usage:
 *   npx tsx scripts/careeros-cache-refresh.ts
 *   npx tsx scripts/careeros-cache-refresh.ts "software engineer" "nurse"
 */
async function main() {
  const keywords = process.argv.slice(2).filter((k) => k.trim().length > 0)

  await sendCareerOSEvent({
    name: "careeros/cache.refresh",
    data: keywords.length > 0 ? { onetKeywords: keywords } : {},
  })

  console.log(
    "[careeros] cache.refresh sent",
    keywords.length > 0 ? { onetKeywords: keywords } : "(server defaults)",
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

import { sendCareerOSEvent } from "../lib/careeros/inngest/client"

/**
 * Manual trigger for salary-band cache refresh.
 *
 * Usage:
 *   npx tsx scripts/careeros-salary-refresh.ts
 *   npx tsx scripts/careeros-salary-refresh.ts --soc 15-1252.00 --region US-NY
 */
function parseArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i === -1) return undefined
  return process.argv[i + 1]
}

async function main() {
  const soc = parseArg("--soc")
  const region = parseArg("--region")
  const maxCombosRaw = parseArg("--max-combos")
  const max_combos =
    maxCombosRaw && Number.isFinite(Number(maxCombosRaw))
      ? Number(maxCombosRaw)
      : undefined

  await sendCareerOSEvent({
    name: "careeros/market.refresh-salary",
    data: {
      ...(soc ? { soc_codes: [soc] } : {}),
      ...(region ? { region_codes: [region] } : {}),
      ...(max_combos ? { max_combos } : {}),
      offset: 0,
    },
  })

  console.log("[careeros] market.refresh-salary sent", {
    soc: soc ?? "(default list)",
    region: region ?? "(default list)",
    max_combos: max_combos ?? "(default env)",
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

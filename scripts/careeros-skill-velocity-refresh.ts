import { sendCareerOSEvent } from "../lib/careeros/inngest/client"

async function main() {
  const regions = process.argv.slice(2).filter((x) => x.trim().length > 0)
  await sendCareerOSEvent({
    name: "careeros/market.refresh-skill-velocity",
    data: regions.length ? { region_codes: regions } : {},
  })
  console.log("[careeros] market.refresh-skill-velocity sent", regions.length ? { regions } : "(default)")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

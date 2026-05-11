import { sendCareerOSEvent } from "../lib/careeros/inngest/client"

async function main() {
  const sourceSocs = process.argv.slice(2).filter((x) => x.trim().length > 0)
  await sendCareerOSEvent({
    name: "careeros/market.refresh-adjacent-roles",
    data: sourceSocs.length ? { source_soc_codes: sourceSocs } : {},
  })
  console.log(
    "[careeros] market.refresh-adjacent-roles sent",
    sourceSocs.length ? { source_soc_codes: sourceSocs } : "(default)",
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

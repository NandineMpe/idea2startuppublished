import { sendCareerOSEvent } from "../lib/careeros/inngest/client"

async function main() {
  await sendCareerOSEvent({
    name: "careeros/feed.ingest",
    data: {},
  })
  console.log("[careeros] feed.ingest sent")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

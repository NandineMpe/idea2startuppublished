import { sendCareerOSEvent } from "../lib/careeros/inngest/client"

async function main() {
  await sendCareerOSEvent({
    name: "careeros/system.ping",
    data: {
      source: "cli-verification",
      timestamp: new Date().toISOString(),
    },
  })

  console.log("[careeros] ping sent")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

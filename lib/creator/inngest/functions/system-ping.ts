import { creatorInngest } from "../client"

export const creatorSystemPing = creatorInngest.createFunction(
  {
    id: "creator-system-ping",
    name: "Creator OS system ping",
    triggers: [{ event: "creator/system.ping" }],
  },
  async ({ event, step }) => {
    await step.run("log-ping", async () => {
      console.log("[creator] ping received", {
        source: event.data.source,
        timestamp: event.data.timestamp,
      })
      return { ok: true }
    })

    return {
      received: event.data,
      acknowledgedAt: new Date().toISOString(),
    }
  }
)

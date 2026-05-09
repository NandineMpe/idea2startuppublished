import { careerosInngest } from "../client"

export const systemPing = careerosInngest.createFunction(
  {
    id: "careeros-system-ping",
    name: "CareerOS system ping",
    triggers: [{ event: "careeros/system.ping" }],
  },
  async ({ event, step }) => {
    await step.run("log-ping", async () => {
      console.log("[careeros] ping received", {
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

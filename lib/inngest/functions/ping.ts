import { inngest } from "@/lib/inngest/client"

export const junoPing = inngest.createFunction(
  {
    id: "juno-ping",
    name: "Juno ping",
    triggers: [{ event: "juno/ping" }],
  },
  async ({ step }) => {
    const health = await step.run("health", () => ({
      ok: true as const,
      at: new Date().toISOString(),
    }))
    return health
  },
)

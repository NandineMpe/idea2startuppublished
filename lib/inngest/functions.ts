import { inngest } from "./client"

/**
 * Health check — trigger manually from Inngest UI with event `juno/ping`.
 * Proves `/api/inngest` wiring before adding cron / fan-out agent jobs.
 */
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

/** Register all functions with `serve()` in `app/api/inngest/route.ts`. */
export const inngestFunctions = [junoPing]

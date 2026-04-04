import { Inngest } from "inngest"

/**
 * @see docs/architecture-agentic-inngest.md
 * Pass eventKey explicitly so `inngest.send()` always sees the key in serverless (Vercel) bundles.
 */
export const inngest = new Inngest({
  id: "idea2startup",
  eventKey: process.env.INNGEST_EVENT_KEY,
})

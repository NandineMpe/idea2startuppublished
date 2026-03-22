import { Inngest } from "inngest"

/**
 * Single Inngest app id for IdeaToStartup / Juno orchestration.
 * @see docs/architecture-agentic-inngest.md
 */
export const inngest = new Inngest({
  id: "idea2startup",
  name: "IdeaToStartup",
})

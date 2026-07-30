import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { synthesiseStoriesForUser } from "@/lib/creator/research/synthesise"

export const creatorResearchSynthesise = creatorInngest.createFunction(
  {
    id: "creator-research-synthesise",
    name: "Creator OS: research synthesis",
    retries: 1,
    // One synthesis at a time per user — a retry racing a fresh run would double-post stories.
    concurrency: { key: "event.data.user_id", limit: 1 },
    triggers: [{ event: "creator/research.synthesise" }],
  },
  async ({ event, step }) => {
    const userId = event.data.user_id

    const result = await step.run("synthesise", async () => {
      return synthesiseStoriesForUser(supabaseAdmin, userId)
    })

    return { user_id: userId, ...result }
  },
)

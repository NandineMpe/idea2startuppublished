import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { deriveLineageForStory } from "@/lib/creator/research/lineage"

export const creatorStoryLineage = creatorInngest.createFunction(
  {
    id: "creator-story-lineage",
    name: "Creator OS: derive story lineage",
    retries: 1,
    // One at a time per user: each run fans out several multi-lane searches.
    concurrency: { key: "event.data.user_id", limit: 1 },
    triggers: [{ event: "creator/story.lineage" }],
  },
  async ({ event, step }) => {
    const { user_id: userId, story_id: storyId } = event.data

    const result = await step.run("derive-lineage", async () => {
      return deriveLineageForStory(supabaseAdmin, userId, storyId)
    })

    return result.ok
      ? { story_id: storyId, entries: result.lineage.timeline.length, tokens: result.tokens }
      : { story_id: storyId, error: result.error }
  },
)

import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { draftForUser } from "@/lib/creator/writer/draft"

export const creatorWriterDraft = creatorInngest.createFunction(
  {
    id: "creator-writer-draft",
    name: "Creator OS: writer draft",
    retries: 1,
    concurrency: { key: "event.data.user_id", limit: 1 },
    triggers: [{ event: "creator/writer.draft" }],
  },
  async ({ event, step }) => {
    const { user_id: userId, story_id: storyId, brief } = event.data

    const result = await step.run("draft", async () => {
      return draftForUser(supabaseAdmin, userId, { storyId, brief })
    })

    return result ?? { skipped: "no story or brief" }
  },
)

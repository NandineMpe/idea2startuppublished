import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { deriveCanonForUser } from "@/lib/creator/canon/derive"

export const creatorCanonDerive = creatorInngest.createFunction(
  {
    id: "creator-canon-derive",
    name: "Creator OS: derive canon",
    retries: 1,
    // Two imports in quick succession must not race two derivations.
    concurrency: { key: "event.data.user_id", limit: 1 },
    // Imports fire this per batch; a short debounce collapses them into one derive.
    debounce: { key: "event.data.user_id", period: "2m" },
    triggers: [{ event: "creator/canon.derive" }],
  },
  async ({ event, step }) => {
    const userId = event.data.user_id

    const result = await step.run("derive", async () => {
      return deriveCanonForUser(supabaseAdmin, userId)
    })

    return result ?? { skipped: "corpus below 3 posts" }
  },
)

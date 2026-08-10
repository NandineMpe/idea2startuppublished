import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { synthesiseStoriesForUser } from "@/lib/creator/research/synthesise"
import { pendingExtractionTargets } from "@/lib/creator/research/extract-queue"
import { extractSignal } from "@/lib/creator/research/extract"

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

    // Read the documents the surviving stories actually cite.
    //
    // Each in its own durable step rather than one loop inside a single step: a
    // 130,000 character PDF plus a model call is comfortably enough to hit a
    // per-step execution window, and losing the seventh document should not
    // re-fetch and re-bill the first six on retry.
    const targets = await step.run("find-documents-to-read", async () => {
      return pendingExtractionTargets(supabaseAdmin, userId)
    })

    const extracts = []
    for (const target of targets) {
      const outcome = await step.run(`read-${target.id}`, async () => {
        try {
          return await extractSignal(supabaseAdmin, userId, target)
        } catch (e) {
          // A source behind a JS-only portal costs that receipt its quote. It
          // does not cost the other documents their read.
          return { ok: false as const, signalId: target.id, error: e instanceof Error ? e.message : String(e) }
        }
      })
      extracts.push(outcome)
    }

    return {
      user_id: userId,
      ...result,
      documents_read: extracts.filter((e) => e.ok).length,
      documents_failed: extracts.filter((e) => !e.ok).length,
    }
  },
)

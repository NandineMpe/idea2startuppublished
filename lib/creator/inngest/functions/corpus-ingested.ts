import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"

/**
 * After an import: fan transcription out per pending row, then queue a canon
 * (re)derivation. Transcription events go first so the derive that follows a
 * later import sees as much spoken content as possible.
 */
export const creatorCorpusIngested = creatorInngest.createFunction(
  {
    id: "creator-corpus-ingested",
    name: "Creator OS: corpus ingested",
    retries: 2,
    triggers: [{ event: "creator/corpus.ingested" }],
  },
  async ({ event, step }) => {
    const { user_id: userId, content_ids: contentIds } = event.data

    // Pasted URLs arrive with neither caption nor counts; enrichment recovers
    // both, plus the true publish date, from the video page.
    const needsEnrich = await step.run("find-rows-needing-enrichment", async () => {
      const { data, error } = await supabaseAdmin
        .schema("creator")
        .from("creator_content")
        .select("id,caption,metrics")
        .eq("user_id", userId)
        .in("id", contentIds)
        .not("url", "is", null)
      if (error) throw error
      return (data ?? [])
        .filter((row) => !row.caption || !row.metrics)
        .map((row) => row.id as string)
    })

    if (needsEnrich.length) {
      await step.sendEvent(
        "fan-out-enrich",
        needsEnrich.map((id) => ({
          name: "creator/content.enrich" as const,
          data: { user_id: userId, content_id: id },
        })),
      )
    }

    const pendingIds = await step.run("find-pending-transcripts", async () => {
      const { data, error } = await supabaseAdmin
        .schema("creator")
        .from("creator_content")
        .select("id")
        .eq("user_id", userId)
        .in("id", contentIds)
        .eq("transcript_status", "pending")
      if (error) throw error
      return (data ?? []).map((row) => row.id as string)
    })

    if (pendingIds.length) {
      await step.sendEvent(
        "fan-out-transcription",
        pendingIds.map((id) => ({
          name: "creator/content.transcribe" as const,
          data: { user_id: userId, content_id: id },
        })),
      )
    }

    await step.sendEvent("queue-canon-derive", {
      name: "creator/canon.derive",
      data: { user_id: userId },
    })

    return {
      user_id: userId,
      ingested: contentIds.length,
      enrich_queued: needsEnrich.length,
      transcriptions_queued: pendingIds.length,
    }
  },
)

import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { fetchTikTokOEmbed } from "@/lib/creator/ingest/oembed"

/**
 * Fills in what a pasted URL could not carry: the caption, via TikTok's public
 * oEmbed endpoint. Runs before transcription so the canon has text to read even
 * when no audio is reachable.
 */
export const creatorContentEnrich = creatorInngest.createFunction(
  {
    id: "creator-content-enrich",
    name: "Creator OS: enrich content from URL",
    retries: 2,
    // Politeness toward a public unauthenticated endpoint.
    concurrency: { limit: 4 },
    triggers: [{ event: "creator/content.enrich" }],
  },
  async ({ event, step }) => {
    const { user_id: userId, content_id: contentId } = event.data

    const row = await step.run("load-row", async () => {
      const { data, error } = await supabaseAdmin
        .schema("creator")
        .from("creator_content")
        .select("id,url,caption,raw_payload")
        .eq("id", contentId)
        .eq("user_id", userId)
        .maybeSingle()
      if (error) throw error
      return data
    })

    if (!row?.url || row.caption) {
      return { content_id: contentId, outcome: "skipped" }
    }

    const meta = await step.run("fetch-oembed", async () => {
      return fetchTikTokOEmbed(row.url as string)
    })

    if (!meta?.caption) {
      return { content_id: contentId, outcome: "no-metadata" }
    }

    await step.run("store-caption", async () => {
      const raw = (row.raw_payload as Record<string, unknown> | null) ?? {}
      const { error } = await supabaseAdmin
        .schema("creator")
        .from("creator_content")
        .update({
          caption: meta.caption,
          raw_payload: {
            ...raw,
            oembed: {
              author_handle: meta.authorHandle,
              author_name: meta.authorName,
              thumbnail_url: meta.thumbnailUrl,
            },
          },
        })
        .eq("id", contentId)
      if (error) throw error
    })

    return { content_id: contentId, outcome: "enriched", caption: meta.caption }
  },
)

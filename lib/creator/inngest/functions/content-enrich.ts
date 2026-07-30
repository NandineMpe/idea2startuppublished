import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { fetchTikTokOEmbed, fetchTikTokVideoDetail } from "@/lib/creator/ingest/oembed"

/**
 * Fills in what a pasted URL could not carry.
 *
 * Two sources, tried in order:
 *  1. the video page's rehydration blob — caption, view/like/comment/share
 *     counts, and the true publish date; unofficial, so it may be blocked
 *  2. oEmbed — official and keyless, but caption only
 *
 * Re-firing this event for an existing row is also the metrics refresh path:
 * counts are always rewritten, while caption and date are only filled in when
 * missing or when the page gives an authoritative value.
 */
export const creatorContentEnrich = creatorInngest.createFunction(
  {
    id: "creator-content-enrich",
    name: "Creator OS: enrich content from URL",
    retries: 2,
    // Deliberately slow: these are unauthenticated page loads, and hammering
    // them is the fastest way to start getting challenge pages instead of data.
    concurrency: { limit: 2 },
    throttle: { limit: 20, period: "1m" },
    triggers: [{ event: "creator/content.enrich" }],
  },
  async ({ event, step }) => {
    const { user_id: userId, content_id: contentId } = event.data

    const row = await step.run("load-row", async () => {
      const { data, error } = await supabaseAdmin
        .schema("creator")
        .from("creator_content")
        .select("id,url,caption,posted_at,metrics,raw_payload")
        .eq("id", contentId)
        .eq("user_id", userId)
        .maybeSingle()
      if (error) throw error
      return data
    })

    if (!row?.url) return { content_id: contentId, outcome: "no-url" }
    const url = row.url as string

    const detail = await step.run("fetch-video-detail", async () => {
      return fetchTikTokVideoDetail(url)
    })

    const update: Record<string, unknown> = {}

    if (detail?.metrics) {
      update.metrics = detail.metrics
      update.metrics_captured_at = new Date().toISOString()
    }
    // The page's createTime is TikTok's own value, so it outranks the
    // import-time placeholder a pasted URL was given.
    if (detail?.postedAt) update.posted_at = detail.postedAt
    if (detail?.caption && !row.caption) update.caption = detail.caption

    // Fall back to oEmbed only for what the page did not provide.
    if (!row.caption && !update.caption) {
      const oembed = await step.run("fetch-oembed", async () => fetchTikTokOEmbed(url))
      if (oembed?.caption) {
        update.caption = oembed.caption
        const raw = (row.raw_payload as Record<string, unknown> | null) ?? {}
        update.raw_payload = {
          ...raw,
          oembed: {
            author_handle: oembed.authorHandle,
            author_name: oembed.authorName,
            thumbnail_url: oembed.thumbnailUrl,
          },
        }
      }
    }

    if (!Object.keys(update).length) {
      return { content_id: contentId, outcome: "no-metadata" }
    }

    await step.run("store", async () => {
      const { error } = await supabaseAdmin
        .schema("creator")
        .from("creator_content")
        .update(update)
        .eq("id", contentId)
      if (error) throw error
    })

    return {
      content_id: contentId,
      outcome: "enriched",
      got_metrics: Boolean(update.metrics),
      got_date: Boolean(update.posted_at),
      got_caption: Boolean(update.caption),
    }
  },
)

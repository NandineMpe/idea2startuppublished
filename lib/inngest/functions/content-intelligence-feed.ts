import { inngest } from "@/lib/inngest/client"
import { classifyAndScore, buildBriefing } from "@/lib/content-intelligence/classifier"
import { fetchTier1Sources } from "@/lib/content-intelligence/sources"
import { pruneStoriesOutsideBriefing, storeBriefing, storeStories } from "@/lib/content-intelligence/store"
import { CONTENT_FEED_MANUAL_DIGEST_REQUESTED } from "@/lib/inngest/event-names"

async function runForUser(userId: string, angle?: string) {
  const raw = await fetchTier1Sources()
  if (raw.length === 0) return { userId, status: "no-items" as const }
  // Keep source diversity so one prolific feed does not dominate each run.
  const bySource = new Map<string, typeof raw>()
  for (const item of raw) {
    if (!bySource.has(item.source)) bySource.set(item.source, [])
    bySource.get(item.source)!.push(item)
  }
  const diverseRaw: typeof raw = []
  const maxPerSource = 6
  for (const items of bySource.values()) {
    items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  }
  for (let i = 0; i < maxPerSource; i += 1) {
    for (const items of bySource.values()) {
      if (items[i]) diverseRaw.push(items[i])
    }
  }
  const classified = await classifyAndScore(diverseRaw.slice(0, 120), angle)
  const briefing = buildBriefing(classified, angle)
  await storeBriefing(userId, briefing)
  await storeStories(userId, briefing.id, classified)
  await pruneStoriesOutsideBriefing(userId, briefing.id)
  return { userId, status: "ok" as const, processed: classified.length, briefingId: briefing.id }
}

export const contentFeedManualDigest = inngest.createFunction(
  {
    id: "content-feed-manual-digest",
    name: "Content Feed: Manual Digest",
    triggers: [{ event: CONTENT_FEED_MANUAL_DIGEST_REQUESTED }],
    concurrency: { limit: 3 },
  },
  async ({ event, step }) => {
    const { userId, angle } = event.data as { userId: string; angle?: string }
    return await step.run("run-manual", () => runForUser(userId, angle))
  },
)

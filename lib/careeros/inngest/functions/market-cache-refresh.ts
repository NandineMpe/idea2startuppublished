import { careerosMinIntervalMs } from "@/lib/careeros/integrations/rate-limits"
import { probeOnetOccupationsKeyword } from "@/lib/careeros/integrations/onet-request"
import { careerosInngest } from "../client"

/** Default taxonomy keywords for v1 warm probes — extend when ingestion expands. */
const DEFAULT_ONET_PROBE_KEYWORDS = ["software developer", "product manager"]

function stepSlug(index: number, keyword: string): string {
  const safe =
    keyword.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "kw"
  return `${index}-${safe.slice(0, 48)}`
}

export const marketCacheRefresh = careerosInngest.createFunction(
  {
    id: "careeros-market-cache-refresh",
    name: "CareerOS market cache refresh (O*NET paced)",
    retries: 2,
    triggers: [
      // Weekly Sunday 03:00 UTC — aligns with “weekly market cache” cadence; adjust as needed.
      { cron: "0 3 * * 0" },
      { event: "careeros/cache.refresh" },
    ],
  },
  async ({ step, event }) => {
    const keywordsFromEvent =
      event?.name === "careeros/cache.refresh" &&
      event.data &&
      typeof event.data === "object" &&
      event.data !== null &&
      "onetKeywords" in event.data &&
      Array.isArray((event.data as { onetKeywords?: unknown }).onetKeywords)
        ? ((event.data as { onetKeywords: string[] }).onetKeywords ?? []).filter(
            (k) => typeof k === "string" && k.trim().length > 0,
          )
        : null

    const keywords =
      keywordsFromEvent && keywordsFromEvent.length > 0
        ? keywordsFromEvent
        : DEFAULT_ONET_PROBE_KEYWORDS

    const paceMs = careerosMinIntervalMs("onet")

    const results: Array<
      Awaited<ReturnType<typeof probeOnetOccupationsKeyword>> & { keyword: string }
    > = []

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i]!.trim()
      const slug = stepSlug(i, keyword)

      const result = await step.run(`onet-probe-${slug}`, () =>
        probeOnetOccupationsKeyword(keyword),
      )

      results.push({ keyword, ...result })

      const isLast = i === keywords.length - 1
      if (!isLast && paceMs > 0) {
        await step.sleep(`onet-pace-after-${slug}`, paceMs)
      }
    }

    return {
      vendor: "onet" as const,
      pacedIntervalMs: paceMs,
      keywordsAttempted: keywords,
      results,
    }
  },
)

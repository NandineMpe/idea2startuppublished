import { fetchRssLikeSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentPragmaticEngineer(hoursBack = 72) {
  return fetchRssLikeSource({
    sourceKey: "pragmatic-engineer",
    url: "https://newsletter.pragmaticengineer.com/feed",
    hoursBack: Math.max(hoursBack, 24 * 30),
  })
}

export function pingPragmaticEngineer() {
  return pingFeedAdapter(fetchRecentPragmaticEngineer)
}

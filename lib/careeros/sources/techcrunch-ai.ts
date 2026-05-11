import { fetchRssLikeSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentTechCrunchAi(hoursBack = 72) {
  return fetchRssLikeSource({
    sourceKey: "techcrunch-ai",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    hoursBack,
  })
}

export function pingTechCrunchAi() {
  return pingFeedAdapter(fetchRecentTechCrunchAi)
}

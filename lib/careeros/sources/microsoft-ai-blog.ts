import { fetchRssLikeSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

/** Microsoft AI blog (Copilot, Azure AI, enterprise AI product news). */
export function fetchRecentMicrosoftAiBlog(hoursBack = 48) {
  return fetchRssLikeSource({
    sourceKey: "microsoft-ai-blog",
    url: "https://blogs.microsoft.com/ai/feed/",
    hoursBack,
  })
}

export function pingMicrosoftAiBlog() {
  return pingFeedAdapter(fetchRecentMicrosoftAiBlog)
}

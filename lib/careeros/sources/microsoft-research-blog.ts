import { fetchRssLikeSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentMicrosoftResearchBlog(hoursBack = 72) {
  return fetchRssLikeSource({
    sourceKey: "microsoft-research-blog",
    url: "https://www.microsoft.com/en-us/research/feed/",
    hoursBack: Math.max(hoursBack, 24 * 30),
  })
}

export function pingMicrosoftResearchBlog() {
  return pingFeedAdapter(fetchRecentMicrosoftResearchBlog)
}

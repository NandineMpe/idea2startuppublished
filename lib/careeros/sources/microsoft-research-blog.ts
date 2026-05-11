import { fetchRssLikeSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentMicrosoftResearchBlog(hoursBack = 72) {
  return fetchRssLikeSource({
    sourceKey: "microsoft-research-blog",
    url: "https://www.microsoft.com/en-us/research/feed/",
    hoursBack,
  })
}

export function pingMicrosoftResearchBlog() {
  return pingFeedAdapter(fetchRecentMicrosoftResearchBlog)
}

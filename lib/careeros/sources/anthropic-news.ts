import { fetchRssLikeSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentAnthropicNews(hoursBack = 48) {
  return fetchRssLikeSource({
    sourceKey: "anthropic-news",
    url: "https://www.anthropic.com/rss.xml",
    hoursBack,
  })
}

export function pingAnthropicNews() {
  return pingFeedAdapter(fetchRecentAnthropicNews)
}

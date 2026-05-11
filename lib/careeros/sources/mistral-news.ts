import { fetchRssLikeSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentMistralNews(hoursBack = 72) {
  return fetchRssLikeSource({
    sourceKey: "mistral-news",
    url: "https://mistral.ai/news/rss.xml",
    hoursBack,
  })
}

export function pingMistralNews() {
  return pingFeedAdapter(fetchRecentMistralNews)
}

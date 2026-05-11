import { fetchRssLikeSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentOpenAiNews(hoursBack = 48) {
  return fetchRssLikeSource({
    sourceKey: "openai-news",
    url: "https://openai.com/news/rss.xml",
    hoursBack,
  })
}

export function pingOpenAiNews() {
  return pingFeedAdapter(fetchRecentOpenAiNews)
}

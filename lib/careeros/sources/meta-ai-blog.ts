import { fetchRssLikeSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentMetaAiBlog(hoursBack = 48) {
  return fetchRssLikeSource({
    sourceKey: "meta-ai-blog",
    url: "https://ai.meta.com/blog/rss/",
    hoursBack,
  })
}

export function pingMetaAiBlog() {
  return pingFeedAdapter(fetchRecentMetaAiBlog)
}

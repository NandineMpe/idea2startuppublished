import { fetchRssLikeSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentEleutherAiBlog(hoursBack = 72) {
  return fetchRssLikeSource({
    sourceKey: "eleutherai-blog",
    url: "https://blog.eleuther.ai/rss/",
    hoursBack,
  })
}

export function pingEleutherAiBlog() {
  return pingFeedAdapter(fetchRecentEleutherAiBlog)
}

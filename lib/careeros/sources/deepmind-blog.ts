import { fetchRssLikeSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentDeepMindBlog(hoursBack = 48) {
  return fetchRssLikeSource({
    sourceKey: "deepmind-blog",
    url: "https://deepmind.google/blog/rss.xml",
    hoursBack: Math.max(hoursBack, 24 * 30),
  })
}

export function pingDeepMindBlog() {
  return pingFeedAdapter(fetchRecentDeepMindBlog)
}

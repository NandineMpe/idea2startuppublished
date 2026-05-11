import { fetchRssLikeSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentDeepMindBlog(hoursBack = 48) {
  return fetchRssLikeSource({
    sourceKey: "deepmind-blog",
    url: "https://deepmind.google/discover/blog/rss.xml",
    hoursBack,
  })
}

export function pingDeepMindBlog() {
  return pingFeedAdapter(fetchRecentDeepMindBlog)
}

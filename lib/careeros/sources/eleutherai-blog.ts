import { fetchHtmlLinkSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentEleutherAiBlog(hoursBack = 72) {
  return fetchHtmlLinkSource({
    sourceKey: "eleutherai-blog",
    url: "https://blog.eleuther.ai/",
    hoursBack,
    includePath: /^\/[^/]+\/?$/,
    excludeTitle: /^(rss|github|discord|twitter|archive)$/i,
    transformTitle: (title) =>
      title
        .replace(/\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\s+·.*$/i, "")
        .trim(),
  })
}

export function pingEleutherAiBlog() {
  return pingFeedAdapter(fetchRecentEleutherAiBlog)
}

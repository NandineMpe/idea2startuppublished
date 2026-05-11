import { fetchHtmlLinkSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentMetaAiBlog(hoursBack = 48) {
  return fetchHtmlLinkSource({
    sourceKey: "meta-ai-blog",
    url: "https://ai.meta.com/blog/",
    hoursBack,
    includePath: /^\/blog\/[^/]+\/?$/,
    excludeTitle: /^(featured|learn more)$/i,
  })
}

export function pingMetaAiBlog() {
  return pingFeedAdapter(fetchRecentMetaAiBlog)
}

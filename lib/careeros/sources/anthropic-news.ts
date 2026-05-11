import { fetchHtmlLinkSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentAnthropicNews(hoursBack = 48) {
  return fetchHtmlLinkSource({
    sourceKey: "anthropic-news",
    url: "https://www.anthropic.com/news",
    hoursBack,
    includePath: /^\/news\/[^/]+\/?$/,
    transformTitle: (title) =>
      title
        .replace(/^[A-Z][a-z]+ \d{1,2}, \d{4}\s+/, "")
        .replace(/^(Announcements|Research|Company|News)\s+/i, "")
        .trim(),
  })
}

export function pingAnthropicNews() {
  return pingFeedAdapter(fetchRecentAnthropicNews)
}

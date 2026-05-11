import { fetchHtmlLinkSource, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

export function fetchRecentMistralNews(hoursBack = 72) {
  return fetchHtmlLinkSource({
    sourceKey: "mistral-news",
    url: "https://mistral.ai/news/",
    hoursBack,
    includePath: /^\/news\/[^/]+\/?$/,
    maxTitleLength: 220,
    transformTitle: (title, path) => {
      const firstSentence = title.split(/(?<=\.)\s+/)[0]?.trim()
      if (firstSentence && firstSentence.length >= 8 && firstSentence.length <= 120) {
        return firstSentence
      }
      return (
        path
          .split("/")
          .filter(Boolean)
          .at(-1)
          ?.replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim() ?? title.slice(0, 120).trim()
      )
    },
  })
}

export function pingMistralNews() {
  return pingFeedAdapter(fetchRecentMistralNews)
}

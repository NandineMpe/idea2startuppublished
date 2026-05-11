export type RawFeedItem = {
  source_key: string
  source_item_id: string
  title: string
  body: string
  url: string
  published_at: Date
  authors?: string[]
  raw_payload: Record<string, unknown>
}

export type FeedPingResult = {
  ok: boolean
  status: number
  count_48h: number
  window_hours?: number
  sample: Array<{ title: string; published_at: string; url: string }>
  error?: string
}

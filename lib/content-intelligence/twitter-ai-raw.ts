import type { RawItem } from "@/lib/content-intelligence/types"

/**
 * Live X/Twitter ingestion was removed to avoid paid third-party APIs.
 * Tier-1 RSS feeds in `sources.ts` cover AI/tech headlines.
 */
export async function fetchTwitterAiTechRawItems(): Promise<RawItem[]> {
  return []
}

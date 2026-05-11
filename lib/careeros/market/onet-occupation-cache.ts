import type { OnetOccupationHit } from "@/lib/careeros/integrations/onet-request"
import { supabaseAdmin } from "@/lib/supabase"

/** Data dictionary release tag for `onet_occupations_cache.onet_release` (see O*NET docs). */
export function getOnetDataRelease(): string {
  return (
    process.env.ONET_DATA_RELEASE?.trim() ||
    process.env.ONET_RELEASE?.trim() ||
    "28.3"
  )
}

/**
 * Upsert keyword-search occupation hits into `careeros.onet_occupations_cache`
 * (Module 2.1 — shared market cache).
 */
export async function upsertOnetOccupationsFromKeywordProbe(
  keyword: string,
  hits: OnetOccupationHit[],
): Promise<{ upserted: number; error?: string }> {
  if (!hits.length) {
    return { upserted: 0 }
  }

  const release = getOnetDataRelease()
  const ingestedAt = new Date().toISOString()

  const bySoc = new Map<string, OnetOccupationHit>()
  for (const h of hits) {
    if (h.soc_code?.trim()) {
      bySoc.set(h.soc_code.trim(), h)
    }
  }

  const rows = [...bySoc.values()].map((h) => ({
    onet_soc_code: h.soc_code.trim(),
    onet_release: release,
    title: (h.title?.trim() || h.soc_code).slice(0, 500),
    description: null as string | null,
    attributes: {
      keyword_probe: keyword.trim(),
      ingested_via: "careeros-market-cache-refresh",
      ingested_at: ingestedAt,
    },
  }))

  const { error } = await supabaseAdmin
    .schema("careeros")
    .from("onet_occupations_cache")
    .upsert(rows, { onConflict: "onet_soc_code,onet_release" })

  if (error) {
    return { upserted: 0, error: error.message }
  }

  return { upserted: rows.length }
}

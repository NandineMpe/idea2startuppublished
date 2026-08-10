import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "./query"

export type CreatorExtract = {
  signal_id: string
  source_url: string
  key_claims: Array<{ quote: string; locator: string; why_it_matters: string }>
  silences: string[]
  verified: boolean
  claims_offered: number
  claims_verified: number
  error: string | null
  content_chars: number
}

/** Extracts for a story's cited signals, keyed by signal id. */
export async function loadExtractsForSignals(
  supabase: SupabaseClient,
  userId: string,
  signalIds: string[],
): Promise<Map<string, CreatorExtract>> {
  if (!signalIds.length) return new Map()

  const rows = await safeRows<CreatorExtract>(
    supabase
      .schema("creator")
      .from("creator_extracts")
      .select("signal_id,source_url,key_claims,silences,verified,claims_offered,claims_verified,error,content_chars")
      .eq("user_id", userId)
      .in("signal_id", signalIds),
  )

  return new Map(rows.map((r) => [r.signal_id, r]))
}

/**
 * The read documents, as the writer sees them.
 *
 * Only verified extracts are rendered. An unverified one means fewer than two
 * quotes survived a literal match against the source, and handing a writer
 * quotes that failed verification would defeat the entire point of verifying
 * them: the writer cannot tell the difference, and the creator would end up
 * saying an unchecked sentence on camera in the belief that it came from a
 * document.
 */
export function extractsBlock(extracts: CreatorExtract[]): string {
  const verified = extracts.filter((e) => e.verified && e.key_claims.length > 0)
  if (!verified.length) return ""

  const parts = verified.map((e) => {
    const claims = e.key_claims
      .map((c) => `  - "${c.quote}"${c.locator ? ` [${c.locator}]` : ""}\n    Why it matters: ${c.why_it_matters}`)
      .join("\n")
    const silences = e.silences.length
      ? `\n  What this document does NOT say:\n${e.silences.map((s) => `  - ${s}`).join("\n")}`
      : ""
    return `SOURCE: ${e.source_url}\n${claims}${silences}`
  })

  return [
    "READ DOCUMENTS. These quotes were taken from the source text and each one was verified as a literal match against it, so they can be said on camera as direct quotations and attributed to the document. Prefer them over anything in the receipts, which are search-result snippets.",
    "",
    ...parts,
    "",
    "The silences are frequently the strongest material here. A document that is conspicuously missing the thing a reader would expect is itself the finding, and it is the part no summary of that document will ever contain.",
  ].join("\n")
}

import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { fetchSource, normalise } from "./fetch-source"

/**
 * The extraction pass.
 *
 * Sits between the sweep and synthesis. Its output is the difference between a
 * desk that hands over links and one that hands over the document, and it is
 * the stage that decides whether the creator can honestly say "I read the
 * filing".
 *
 * Two properties are enforced in code rather than requested in the prompt:
 *
 *  1. Every quote must appear verbatim in the fetched text. Not "the model says
 *     it is a quote" — a literal substring match after normalisation. This is
 *     the same discipline as the opportunities route guard: a plausible quote
 *     from a real document is worse than no quote, because it survives every
 *     check a human would think to run.
 *
 *  2. Nothing is re-extracted when the content hash is unchanged. Regulators
 *     get re-fetched constantly by the threads check and almost never change.
 */

export const EXTRACT_PROMPT_VERSION = "creator-extract-v1"

const extractSchema = z.object({
  // Flat newline-delimited with explicit indexes, for the reason recorded
  // throughout this codebase: arrays of objects in this schema make the model
  // emit tool-call markup into the JSON, and positional alignment across
  // several lists silently drifts.
  claim_quotes: z
    .string()
    .describe(
      "The most consequential sentences FROM THE DOCUMENT, ONE PER LINE, prefixed '1: ', '2: '. Two to four. Copy them EXACTLY, character for character, including any awkward phrasing. Every one is checked against the source text and a quote that does not match is discarded. Never tidy, never paraphrase, never join two sentences.",
    ),
  claim_locators: z
    .string()
    .describe(
      "Where each quote is, ONE PER LINE, prefixed with the matching number: '1: p. 14', '2: para 3.2', '3: section 4'. Use whatever the document itself uses.",
    ),
  claim_why: z
    .string()
    .describe(
      "Why each quote matters to a working professional, ONE PER LINE, prefixed with the matching number. One sentence each, maximum 200 characters. Not a restatement of the quote.",
    ),
  silences: z
    .string()
    .describe(
      "What this document conspicuously does NOT say, ONE PER LINE, at most three. A vendor announcement with no error rate, a regulator's report with no deadline, a system card with no third-party evaluation. Only name a silence that is genuinely surprising given what the document IS about. If nothing is conspicuously missing, return an empty string, which is a perfectly good answer.",
    ),
})

const SYSTEM_PROMPT = `You are reading a primary source so that a creator does not have to. You are given the full text of one document. Everything you return must come from that text.

WHAT YOU ARE LOOKING FOR. The sentences a working professional would want to have seen with their own eyes: the number, the admission, the obligation, the date something bites, the thing the summary of this document left out. Prefer a sentence that commits somebody to something over a sentence that describes a position.

QUOTES ARE CHECKED. Every quote you return is matched as a literal substring against the source text after whitespace normalisation. A quote that does not match is thrown away, and if fewer than two survive, the whole extract is marked unverified and the creator is told the document could not be quoted. So:
- Copy exactly. Character for character.
- Do not fix a typo, expand an abbreviation, change a spelling, or convert a numeral.
- Do not stitch two sentences together, even if they are adjacent.
- Do not add an ellipsis or square brackets.
- If a passage is too long, quote the part of it that matters rather than trimming the middle.
A shorter exact quote always beats a longer approximate one.

SILENCES. What the document conspicuously does not say is frequently the most useful thing about it, and it is the part no summary will ever contain. A launch announcement with no evaluation results, a consultation with no named respondent, an assurance product with no stated failure mode. Be strict: a silence is only interesting if a reader would reasonably expect the thing to be there. A tax paper not mentioning cryptography is not a silence.

Do not editorialise, do not draw the creator's conclusion for them, and do not speculate about motive. Report what the document says and what it does not.`

/** Normalised quote to store, plus where it was found. */
export type KeyClaim = { quote: string; locator: string; why_it_matters: string }

export type ExtractResult =
  | { ok: true; cached: true; signalId: string }
  | {
      ok: true
      cached: false
      signalId: string
      verified: boolean
      offered: number
      kept: number
      silences: number
      chars: number
      tokens: number
    }
  | { ok: false; signalId: string; error: string }

/** Split "1: text" lines into an index-keyed map, tolerating a missing prefix. */
function indexed(value: string): Map<number, string> {
  const out = new Map<number, string>()
  let fallback = 1
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(/^(\d+)\s*[:.)-]\s*(.+)$/)
    if (match) out.set(Number(match[1]), match[2].trim())
    else out.set(fallback++, trimmed)
  }
  return out
}

export async function extractSignal(
  supabase: SupabaseClient,
  userId: string,
  signal: { id: string; url: string | null; title: string },
): Promise<ExtractResult> {
  if (!signal.url) {
    return { ok: false, signalId: signal.id, error: "No URL on this signal." }
  }

  const fetched = await fetchSource(signal.url)
  if (!fetched.ok) {
    await supabase
      .schema("creator")
      .from("creator_extracts")
      .upsert(
        {
          user_id: userId,
          signal_id: signal.id,
          source_url: signal.url,
          content_hash: "",
          verified: false,
          error: fetched.error,
          model: CREATOR_MODEL_VERSION,
        },
        { onConflict: "signal_id" },
      )
    await markExtracted(supabase, userId, signal.id)
    return { ok: false, signalId: signal.id, error: fetched.error }
  }

  // The cache. Checked on the hash of the fetched text rather than on age,
  // because age says nothing: a consultation page fetched five minutes ago and
  // a final rule fetched last month are equally worth not re-reading if neither
  // has changed a character.
  const { data: existing } = await supabase
    .schema("creator")
    .from("creator_extracts")
    .select("content_hash,verified")
    .eq("signal_id", signal.id)
    .maybeSingle()
  if (existing?.content_hash === fetched.hash && existing.verified) {
    await markExtracted(supabase, userId, signal.id)
    return { ok: true, cached: true, signalId: signal.id }
  }

  const { object, usage } = await creatorGenerateObject({
    schema: extractSchema,
    system: SYSTEM_PROMPT,
    prompt: `DOCUMENT: ${signal.title}\nSOURCE: ${signal.url}${
      fetched.truncated ? "\n(Truncated: this is the first portion of a longer document.)" : ""
    }\n\n--- FULL TEXT ---\n${fetched.text}\n--- END ---\n\nExtract the key claims and the silences.`,
    agent: "research.extract",
    log: { supabase, userId },
    maxOutputTokens: 2000,
  })

  const quotes = indexed(object.claim_quotes)
  const locators = indexed(object.claim_locators)
  const whys = indexed(object.claim_why)

  // Verification. The haystack is normalised the same way the fetched text was,
  // and so is each quote, because the two have to agree about what a space is.
  const haystack = normalise(fetched.text).toLowerCase()
  const kept: KeyClaim[] = []
  for (const [index, rawQuote] of quotes) {
    const quote = normalise(rawQuote.replace(/^["“”']|["“”']$/g, ""))
    if (quote.length < 20) continue
    if (!haystack.includes(quote.toLowerCase())) continue
    kept.push({
      quote,
      locator: locators.get(index) ?? "",
      why_it_matters: (whys.get(index) ?? "").slice(0, 200),
    })
  }

  const silences = object.silences
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*(?:[-•*]|\d+[.):])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3)

  // Two is the floor. One verified quote is an anecdote, and the whole purpose
  // of this stage is that the creator can stand a claim up without opening the
  // document themselves.
  const verified = kept.length >= 2

  const { error } = await supabase
    .schema("creator")
    .from("creator_extracts")
    .upsert(
      {
        user_id: userId,
        signal_id: signal.id,
        source_url: signal.url,
        fetched_at: new Date().toISOString(),
        content_hash: fetched.hash,
        content_chars: fetched.chars,
        media_type: fetched.mediaType,
        key_claims: kept,
        silences,
        verified,
        claims_offered: quotes.size,
        claims_verified: kept.length,
        error: verified
          ? null
          : `Only ${kept.length} of ${quotes.size} quotes matched the source text verbatim.`,
        model: CREATOR_MODEL_VERSION,
      },
      { onConflict: "signal_id" },
    )
  if (error) return { ok: false, signalId: signal.id, error: error.message }

  await markExtracted(supabase, userId, signal.id)

  return {
    ok: true,
    cached: false,
    signalId: signal.id,
    verified,
    offered: quotes.size,
    kept: kept.length,
    silences: silences.length,
    chars: fetched.chars,
    tokens: usage.totalTokens,
  }
}

async function markExtracted(supabase: SupabaseClient, userId: string, signalId: string) {
  await supabase
    .schema("creator")
    .from("creator_signals")
    .update({ extracted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", signalId)
}

import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { creatorGenerateObject } from "@/lib/creator/ai/claude"
import { loadWorth } from "@/lib/creator/load-worth"
import { loadCreatorPosts } from "@/lib/creator/load-corpus"
import { engagementRate, type CreatorPost } from "@/lib/creator/types"

/**
 * Brand-facing positioning.
 *
 * A creator bio usually describes the person. A marketer screening inbound is
 * asking three questions instead: who exactly watches this, do they respond,
 * and is it safe to put our name next to. This writes to those questions using
 * figures computed here — the model never sources a number.
 *
 * TikTok engagement sits in low single digits, so a creator materially above
 * that has the single most persuasive line available and it is usually buried.
 */

export const POSITIONING_PROMPT_VERSION = "creator-positioning-v1"

/** Typical TikTok engagement, for stating the creator's rate against a baseline. */
const CATEGORY_ENGAGEMENT_BASELINE = 5

const positioningSchema = z.object({
  headline: z
    .string()
    .describe("One line, under 15 words. The positioning a marketer reads first. Not a job title — a claim about who this reaches and why it matters."),
  bio_short: z.string().describe("About 40 words. Media-kit header version."),
  bio_long: z.string().describe("About 120 words. The full bio, written in third person, brand-facing."),
  audience: z
    .string()
    .describe("Who actually watches, as specifically as the content supports. Job titles and sectors, not 'people interested in AI'."),
  /**
   * Newline-delimited strings rather than arrays.
   *
   * With several string arrays in one schema, this model emits its tool-call
   * parameter markup inside the JSON values — `"<parameter name=\"0\">..."` —
   * and the whole generation fails validation despite finishing cleanly. One
   * string per field sidesteps it, and splitting in code costs nothing.
   */
  why_brands: z
    .string()
    .describe("3-5 distinct reasons a marketer should look twice, ONE PER LINE. Concrete and checkable, not adjectives."),
  proof_points: z
    .string()
    .describe("2-5 verbatim figures from the supplied data, ONE PER LINE. Never invent or round upward."),
  brand_categories: z
    .string()
    .describe("3-8 brand categories that fit this audience, ONE PER LINE, specific enough to search a sponsor list with."),
  not_a_fit: z
    .string()
    .describe("1-4 categories to decline, ONE PER LINE. Saying what you will not take is itself a credibility signal."),
})

export type CreatorPositioning = {
  headline: string
  bio_short: string
  bio_long: string
  audience: string
  why_brands: string[]
  proof_points: string[]
  brand_categories: string[]
  not_a_fit: string[]
}

function toLines(value: string, limit: number): string[] {
  return value
    .split(/\r?\n/)
    // Strip a bullet or a numbered-list prefix only. The trailing \s+ is what
    // makes this safe: a line that opens with a real figure ("12.7% median
    // engagement", "31,817 saves") has no space after the digits, so it is left
    // intact — an earlier version ate the number and reported "% median".
    .map((line) => line.replace(/^\s*(?:[-•*–]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .slice(0, limit)
}

const SYSTEM_PROMPT = `You write brand-facing positioning for a creator's media kit. Your reader is a brand marketer or agency planner deciding, in about twenty seconds, whether to reply.

What makes them look twice, in order:
1. A precisely defined audience. "Finance and audit professionals at mid-market firms" earns a second look; "people interested in AI" does not.
2. Engagement against the category norm. Reach is bought cheaply everywhere; a response rate is not.
3. Brand safety, especially for regulated categories. A creator who sources every claim and refuses undisclosed ads is a materially lower risk, and that is worth saying plainly.
4. Evidence of subject authority — the specific institutions, cases or sectors covered.

Rules:
- Use only the supplied figures. Never invent, estimate or round a number upward.
- No hype vocabulary: no "passionate", "storyteller", "thought leader", "trusted voice", "game-changing". A marketer discounts all of it.
- Third person for the bios.
- why_brands must be reasons, not adjectives. "Cites a named case, study or filing in every post, which clears legal review faster in regulated categories" is a reason. "Highly credible" is not.
- not_a_fit should follow from the creator's demonstrated standards, not be invented squeamishness.
- If the creator has no recorded brand partnerships, never imply otherwise.`

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function performanceBlock(posts: CreatorPost[]): string {
  const measured = posts.filter((p) => p.metrics)
  if (!measured.length) return "No metrics captured yet."

  const rates = measured.map((p) => engagementRate(p.metrics)).filter((r): r is number => r !== null)
  const medianEngagement = median(rates)
  const views = measured.map((p) => p.metrics!.views).filter((v) => typeof v === "number")
  const best = measured.reduce<CreatorPost | null>((acc, p) => {
    const r = engagementRate(p.metrics)
    const accR = acc ? engagementRate(acc.metrics) : null
    return r !== null && (accR === null || r > accR) ? p : acc
  }, null)

  const totalViews = views.reduce((a, b) => a + b, 0)
  const totalSaves = measured.reduce((a, p) => a + (p.metrics?.saves ?? 0), 0)

  return [
    `Posts measured: ${measured.length}`,
    `Total views across measured posts: ${totalViews.toLocaleString()}`,
    `Median views per post: ${median(views)?.toLocaleString() ?? "?"}`,
    medianEngagement !== null
      ? `Median engagement: ${medianEngagement.toFixed(1)}% (typical TikTok engagement is around ${CATEGORY_ENGAGEMENT_BASELINE}%)`
      : null,
    `Total saves (bookmarks): ${totalSaves.toLocaleString()}`,
    best && engagementRate(best.metrics) !== null
      ? `Best-performing post: ${engagementRate(best.metrics)!.toFixed(1)}% engagement on ${best.metrics!.views.toLocaleString()} views`
      : null,
  ]
    .filter(Boolean)
    .join("\n")
}

export type PositioningResult =
  | { ok: true; positioning: CreatorPositioning; tokens: number }
  | { ok: false; error: string }

export async function derivePositioningForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<PositioningResult> {
  const { data: canon } = await supabase
    .schema("creator")
    .from("creator_canon")
    .select("version,pillars,formats,voice,topics,corpus_size,confidence")
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!canon) {
    return { ok: false, error: "Derive your canon first — positioning is written from it." }
  }

  const [posts, worthContext, { data: pastDeals }] = await Promise.all([
    loadCreatorPosts(supabase, userId),
    loadWorth(supabase, userId),
    supabase
      .schema("creator")
      .from("creator_work")
      .select("title")
      .eq("user_id", userId)
      .eq("kind", "deal")
      .in("state", ["approved", "active", "done"])
      .limit(10),
  ])

  const headline = worthContext.worth?.headline
  const rateLine = headline
    ? `Defensible rate: ${headline.currency} ${headline.rate_low.toLocaleString()}-${headline.rate_high.toLocaleString()} per sponsored post.`
    : "Rate band not yet derivable."

  const clients = (pastDeals ?? []).map((d) => d.title).join(", ")

  try {
    const { object, usage } = await creatorGenerateObject({
      schema: positioningSchema,
      system: SYSTEM_PROMPT,
      prompt: `CANON v${canon.version} (${canon.corpus_size} posts, confidence ${canon.confidence})

PILLARS — what they actually make:
${JSON.stringify(canon.pillars)}

FORMATS — the structures they return to, with performance:
${JSON.stringify(canon.formats)}

TOPICS — weighted by share of output:
${JSON.stringify(canon.topics)}

VOICE — note never_says, which is the brand-safety evidence:
${JSON.stringify(canon.voice)}

PERFORMANCE:
${performanceBlock(posts)}

${rateLine}

PRIOR BRAND PARTNERSHIPS: ${clients || "NONE ON RECORD — do not imply any."}

Write the brand-facing positioning.`,
      maxOutputTokens: 32000,
    })

    // Split the delimited fields and cap them here: overshooting a count is
    // free to fix in code and fatal to enforce in the schema.
    const trimmed: CreatorPositioning = {
      headline: object.headline,
      bio_short: object.bio_short,
      bio_long: object.bio_long,
      audience: object.audience,
      why_brands: toLines(object.why_brands, 5),
      proof_points: toLines(object.proof_points, 5),
      brand_categories: toLines(object.brand_categories, 8),
      not_a_fit: toLines(object.not_a_fit, 4),
    }

    const { error } = await supabase
      .schema("creator")
      .from("creator_canon")
      .update({ positioning: trimmed, positioning_derived_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("version", canon.version)
    if (error) return { ok: false, error: error.message }

    return { ok: true, positioning: trimmed, tokens: usage.totalTokens }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not write the positioning." }
  }
}

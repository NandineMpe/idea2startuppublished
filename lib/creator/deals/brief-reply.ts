import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { loadWorth } from "@/lib/creator/load-worth"
import { loadCreatorCanon } from "@/lib/creator/load-canon"
import { loadCreatorPosts } from "@/lib/creator/load-corpus"
import { engagementRate, type CreatorPost } from "@/lib/creator/types"

/**
 * Reply to an inbound brand brief.
 *
 * Everything quotable is computed here from real data and handed to the model
 * as fact — rate bands, format performance, prior clients. The model writes the
 * reply and reads the brief; it never invents a number or a past collaboration,
 * because a fabricated client list or an unbacked rate is the kind of error
 * that ends a deal rather than losing one.
 */

export const BRIEF_REPLY_PROMPT_VERSION = "creator-brief-reply-v1"

const replySchema = z.object({
  // nullish, not nullable: the model omits a key as readily as it returns null,
  // and a missing optional field should not fail the whole generation.
  brand: z.string().nullish().describe("Who is writing, if identifiable from the email."),
  what_they_want: z.string().describe("The ask in one or two plain sentences, stripped of pleasantries."),
  deliverables: z.array(z.string()).describe("Each concrete deliverable named or implied."),
  stated_budget: z.string().nullish().describe("Their number if given, verbatim. Null if unstated."),
  watch_outs: z
    .array(z.string())
    .describe(
      "Terms that cost money or freedom and are easy to agree to by accident: perpetual or broad usage rights, exclusivity windows, paid-media whitelisting, unlimited revisions, approval chains, tight turnarounds, undisclosed-ad requests.",
    ),
  recommended_format: z.object({
    label: z.string().describe("Which of the creator's proven formats fits this brief."),
    why: z.string().describe("Why this format suits the ask, referencing its real performance."),
  }),
  quoted_rate: z.object({
    low: z.number(),
    high: z.number(),
    currency: z.string(),
    basis: z.string().describe("The one-line justification a brand can check, using the supplied figures."),
  }),
  reply: z
    .string()
    .describe(
      "The complete email, ready to send. Plain text, no markdown, no placeholder brackets except a signature line.",
    ),
})

export type BriefReply = z.infer<typeof replySchema>

const SYSTEM_PROMPT = `You are the account manager for a creator, replying to an inbound brand brief.

You are given the creator's real performance figures and rate bands. Treat them as the only permissible source of numbers.

Rules:
- Never invent a metric, a rate, or a past client. If the prior-clients list is empty, the reply must not imply any past brand work — write it as a creator with strong audience numbers instead.
- Quote the supplied rate band. If the brief names a budget below it, do not simply accept: state the band and what justifies it, and offer a scope that fits their number rather than discounting the rate.
- Lead the reply with interest and a concrete point of view on their product or campaign, not with price. Price comes after you have shown you understood the brief.
- Recommend a format from the creator's proven formats and say what it does — cite the real median views or engagement supplied.
- Keep the reply under 220 words. Brands skim. Warm, direct, specific; no hype, no gratitude-stacking, no "I'd love the opportunity".
- watch_outs are for the creator's eyes only and must not appear in the reply text.
- Write in the creator's voice where a voice profile is given, but a business email is more formal than their content — match register, not slang.`

function formatPerformanceLines(canon: unknown, posts: CreatorPost[]): string {
  const c = canon as { formats?: Array<{ id: string; label: string; median_views: number | null }> } | null
  if (!c?.formats?.length) return "No derived formats yet."

  return c.formats
    .map((f) => {
      const inFormat = posts.filter((p) => p.format_id === f.id && p.metrics)
      const rates = inFormat
        .map((p) => engagementRate(p.metrics))
        .filter((r): r is number => r !== null)
      const medianEngagement = rates.length
        ? [...rates].sort((a, b) => a - b)[Math.floor(rates.length / 2)]
        : null
      return `- ${f.label}: ${inFormat.length} posts, median ${f.median_views?.toLocaleString() ?? "?"} views${
        medianEngagement !== null ? `, ${medianEngagement.toFixed(1)}% engagement` : ""
      }`
    })
    .join("\n")
}

export type BriefReplyResult =
  | { ok: true; reply: BriefReply; tokens: number }
  | { ok: false; error: string }

export async function draftBriefReply(
  supabase: SupabaseClient,
  userId: string,
  emailText: string,
): Promise<BriefReplyResult> {
  const trimmed = emailText.trim()
  if (trimmed.length < 40) {
    return { ok: false, error: "Paste the full email — there is not enough here to read a brief from." }
  }

  const [worthContext, canon, posts, { data: pastDeals }] = await Promise.all([
    loadWorth(supabase, userId),
    loadCreatorCanon(supabase, userId),
    loadCreatorPosts(supabase, userId),
    supabase
      .schema("creator")
      .from("creator_work")
      .select("title,state,created_at")
      .eq("user_id", userId)
      .eq("kind", "deal")
      .in("state", ["approved", "active", "done"])
      .order("created_at", { ascending: false })
      .limit(12),
  ])

  const headline = worthContext.worth?.headline
  const rateBlock = headline
    ? `RATE BAND (from ${headline.sample_size} posts carrying metrics)
Median views per post: ${headline.views_median.toLocaleString()}
Typical range: ${headline.views_p25.toLocaleString()}-${headline.views_p75.toLocaleString()}
Defensible rate: ${headline.currency} ${headline.rate_low.toLocaleString()}-${headline.rate_high.toLocaleString()} per sponsored post
Confidence: ${headline.confidence}`
    : "RATE BAND: not derivable yet — do not quote a specific figure. Ask for their budget instead and say a rate follows the scope."

  const perfBlock = formatPerformanceLines(canon, posts)

  const measured = posts.filter((p) => p.metrics)
  const allRates = measured
    .map((p) => engagementRate(p.metrics))
    .filter((r): r is number => r !== null)
    .sort((a, b) => a - b)
  const medianEngagement = allRates.length ? allRates[Math.floor(allRates.length / 2)] : null

  const audienceBlock = [
    `Posts measured: ${measured.length}`,
    medianEngagement !== null ? `Median engagement: ${medianEngagement.toFixed(1)}%` : null,
    headline ? `Median views: ${headline.views_median.toLocaleString()}` : null,
  ]
    .filter(Boolean)
    .join(" | ")

  const clients = (pastDeals ?? []).map((d) => `- ${d.title} (${d.state})`).join("\n")
  const clientBlock = clients || "NONE — the creator has no recorded prior brand work. Do not imply any."

  const voiceBlock = canon?.voice
    ? `VOICE PROFILE (for register, not slang): ${JSON.stringify(canon.voice)}`
    : "VOICE PROFILE: not derived."

  try {
    const { object, usage } = await creatorGenerateObject({
      schema: replySchema,
      system: SYSTEM_PROMPT,
      prompt: `INBOUND EMAIL
"""
${trimmed.slice(0, 6000)}
"""

${rateBlock}

AUDIENCE: ${audienceBlock}

FORMAT PERFORMANCE (the creator's proven formats):
${perfBlock}

PRIOR BRAND WORK:
${clientBlock}

${voiceBlock}

Read the brief and draft the reply.`,
      maxOutputTokens: 16000,
    })

    return { ok: true, reply: object, tokens: usage.totalTokens }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not draft a reply." }
  }
}

import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { loadWorth } from "@/lib/creator/load-worth"
import { loadCreatorCanon } from "@/lib/creator/load-canon"
import { loadCreatorPosts } from "@/lib/creator/load-corpus"
import { loadCreatorSettings } from "@/lib/creator/load-settings"
import { withoutDashes } from "@/lib/creator/no-dashes"
import { openConversation } from "./conversations"
import { lineItemsBlock, priceLineItems } from "@/lib/creator/worth/line-items"
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
      "Terms that cost money or freedom and are easy to agree to by accident: perpetual or broad usage rights, exclusivity windows, paid-media whitelisting, unlimited revisions, approval chains, tight turnarounds, undisclosed-ad requests. Where the rate card prices one, name the figure inside the watch-out.",
    ),
  /**
   * Newline-delimited rather than an array of objects.
   *
   * Same failure mode as the nested format object below: give this schema a list
   * of {label, amount} and the model emits its tool-call parameter markup into
   * the JSON and abandons every field after it. One line per ask, split in code.
   */
  priced_asks: z
    .string()
    .describe(
      "One line per thing the brief asks for beyond a single organic post, each as 'Label: CURRENCY amount', taken verbatim from the supplied rate card. Empty string if the brief asks for nothing beyond the base. Never invent a line or a figure. No dashes of any kind as separators.",
    ),
  quoted_total: z
    .number()
    .describe("Base fee plus every priced ask above. Equals the base fee when there are no extras."),
  /**
   * Flat scalars rather than nested objects.
   *
   * A bare nested object in this schema makes the model emit its tool-call
   * parameter markup into the JSON — `"<parameter name=\"label\">..."` — and it
   * then abandons every field after it, so the reply itself never arrives. Flat
   * fields are reassembled in code, which costs nothing and cannot fail.
   */
  recommended_format_label: z.string().describe("Which of the creator's proven formats fits this brief."),
  recommended_format_why: z
    .string()
    .describe("Why this format suits the ask, referencing its real performance."),
  quoted_rate_low: z.number(),
  quoted_rate_high: z.number(),
  quoted_rate_currency: z.string(),
  quoted_rate_basis: z
    .string()
    .describe("The one-line justification a brand can check, using the supplied figures."),
  reply: z
    .string()
    .describe(
      "The complete email, ready to send. Plain text, no markdown, no placeholder brackets except a signature line.",
    ),
})

/** The shape the UI consumes — nesting restored after generation. */
export type BriefReply = {
  brand?: string | null
  what_they_want: string
  deliverables: string[]
  stated_budget?: string | null
  watch_outs: string[]
  recommended_format: { label: string; why: string }
  quoted_rate: { low: number; high: number; currency: string; basis: string }
  /** The rights and extras this brief is asking for, each with its price attached. */
  priced_asks: string[]
  quoted_total: number
  reply: string
}

const SYSTEM_PROMPT = `You are the account manager for a creator, replying to an inbound brand brief.

You are given the creator's real performance figures and rate bands. Treat them as the only permissible source of numbers.

Rules:
- Never invent a metric, a rate, or a past client. If the prior-clients list is empty, the reply must not imply any past brand work — write it as a creator with strong audience numbers instead.
- Quote the supplied rate band. If the brief names a budget below it, do not simply accept: state the band and what justifies it, and offer a scope that fits their number rather than discounting the rate.
- A fee buys one organic post on the creator's own handle and nothing else. Read the brief for what it quietly assumes on top — paid amplification, whitelisting or Spark Ads, posting from the brand's own account, use on their site or in email, category exclusivity, extra platforms, extra cuts, raw files, a rushed turnaround. Each of those is on the supplied rate card. Price every one it asks for, using the card's figures exactly, and put them in the reply as a short itemised list under the base fee.
- Itemise rather than bundle. A single larger number reads as expensive; the same number broken into a base fee plus the rights they asked for reads as a quote, and it shows them which line to drop if they want to spend less.
- If the brief is silent on usage, do not price it and do not assume it is organic-only. Say what the fee covers and ask what they intend to run behind it.
- Lead the reply with interest and a concrete point of view on their product or campaign, not with price. Price comes after you have shown you understood the brief.
- Recommend a format from the creator's proven formats and say what it does — cite the real median views or engagement supplied.
- Keep the reply under 220 words. Brands skim. Warm, direct, specific; no hype, no gratitude-stacking, no "I'd love the opportunity".
- watch_outs are for the creator's eyes only and must not appear in the reply text.
- Write in the creator's voice where a voice profile is given, but a business email is more formal than their content — match register, not slang.
- Never use an em dash or an en dash anywhere in the reply text or in any field that reaches the creator. Use a full stop, a comma, a colon or a new sentence. This is absolute: the creator will not send an email containing one, so a reply with one in it is a reply she has to rewrite by hand.`

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
  | { ok: true; reply: BriefReply; conversation_id: string | null; tokens: number }
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

  const [worthContext, canon, posts, { settings }, { data: pastDeals }] = await Promise.all([
    loadWorth(supabase, userId),
    loadCreatorCanon(supabase, userId),
    loadCreatorPosts(supabase, userId),
    loadCreatorSettings(supabase, userId),
    supabase
      .schema("creator")
      .from("creator_work")
      .select("title,state,created_at")
      .eq("user_id", userId)
      // A deleted deal must never be quoted back to a brand as a past client.
      .is("deleted_at", null)
      .eq("kind", "deal")
      .in("state", ["approved", "active", "done"])
      .order("created_at", { ascending: false })
      .limit(12),
  ])

  const headline = worthContext.worth?.headline
  const worth = worthContext.worth
  const rateBlock = headline
    ? `RATE BAND (from ${headline.sample_size} posts carrying metrics)
Median views per post: ${headline.views_median.toLocaleString()}
Typical range: ${headline.views_p25.toLocaleString()}-${headline.views_p75.toLocaleString()}
Defensible rate: ${headline.currency} ${headline.rate_low.toLocaleString()}-${headline.rate_high.toLocaleString()} per sponsored post
Standard quote for a single video: ${headline.currency} ${headline.rate_target.toLocaleString()}
${
  headline.rate_floor
    ? `Hard floor: ${headline.currency} ${headline.rate_floor.toLocaleString()} — a brand has already paid this for one video. Never quote under it, at any scope, for any reason.`
    : "Hard floor: none on record."
}
Confidence: ${headline.confidence}`
    : "RATE BAND: not derivable yet — do not quote a specific figure. Ask for their budget instead and say a rate follows the scope."

  // The rate card is what turns a watch-out into a counter-offer. Flagging that a
  // brief wants perpetual usage is half a warning; flagging that perpetual usage
  // is another 1,900 on top is a negotiating position.
  const cardBlock = worth
    ? `RATE CARD — base fee ${worth.currency} ${worth.base_fee.toLocaleString()} for one video, organic, one platform, creator's own handle. Every figure below is on top of the base and is the only permissible price for that right:

${lineItemsBlock(priceLineItems(worth.base_fee, settings.rate_overrides), worth.currency)}`
    : "RATE CARD: not derivable yet."

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

${cardBlock}

AUDIENCE: ${audienceBlock}

FORMAT PERFORMANCE (the creator's proven formats):
${perfBlock}

PRIOR BRAND WORK:
${clientBlock}

${voiceBlock}

Read the brief and draft the reply.`,
      agent: "deals.brief-reply",
      log: { supabase, userId },
      maxOutputTokens: 16000,
    })

    const reply: BriefReply = {
      brand: object.brand,
      what_they_want: object.what_they_want,
      deliverables: object.deliverables,
      stated_budget: object.stated_budget,
      watch_outs: object.watch_outs,
      recommended_format: {
        label: object.recommended_format_label,
        why: object.recommended_format_why,
      },
      quoted_rate: {
        low: object.quoted_rate_low,
        high: object.quoted_rate_high,
        currency: object.quoted_rate_currency,
        basis: object.quoted_rate_basis,
      },
      priced_asks: (object.priced_asks ?? "")
        .split(/\r?\n/)
        .map((line) => withoutDashes(line.replace(/^[-*\d.\s]+/, "").trim()))
        .filter(Boolean),
      quoted_total: object.quoted_total,
      // The prompt asks for no dashes and this makes it true. The reply is the
      // one field here that gets sent rather than read, so it is the one field
      // where a stray em dash costs a rewrite instead of a shrug.
      reply: withoutDashes(object.reply),
    }

    // Persisted here rather than left in the browser, because a follow-up is
    // written days later against a conversation nothing would otherwise
    // remember. A failed insert must not lose her the reply she is looking at,
    // so it degrades to a null id and the drafting flow carries on.
    const conversationId = await openConversation(supabase, userId, {
      brand: reply.brand ?? null,
      inbound: trimmed,
      what_they_want: reply.what_they_want,
      deliverables: reply.deliverables,
      quoted_total: reply.quoted_total,
      currency: reply.quoted_rate.currency,
      reply: reply.reply,
    })

    return { ok: true, reply, conversation_id: conversationId, tokens: usage.totalTokens }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not draft a reply." }
  }
}

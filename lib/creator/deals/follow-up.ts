import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { creatorGenerateObject } from "@/lib/creator/ai/claude"
import { loadCreatorCanon } from "@/lib/creator/load-canon"
import { loadCreatorPosts } from "@/lib/creator/load-corpus"
import { loadWorth } from "@/lib/creator/load-worth"
import { loadCreatorSettings } from "@/lib/creator/load-settings"
import { lineItemsBlock, priceLineItems } from "@/lib/creator/worth/line-items"
import { withoutDashes } from "@/lib/creator/no-dashes"
import {
  appendMessage,
  daysSilent,
  followUpsSent,
  loadConversation,
  MAX_FOLLOW_UPS,
  type ConversationMessage,
  type CreatorConversation,
} from "./conversations"

/**
 * Chase a brand that has gone quiet.
 *
 * Most deals are lost to silence rather than to a no, and the follow-up is the
 * cheapest revenue in the pipeline. It is also the email people write worst,
 * because writing it feels like asking for a favour, and that feeling leaks
 * into the text as apology, as throat-clearing, and as a restatement of the
 * original pitch that tells the brand nothing it did not already ignore once.
 *
 * The fix is that the three follow-ups do genuinely different jobs, so each has
 * its own brief rather than being the same email sent again with a softer
 * opening.
 */

export const FOLLOW_UP_PROMPT_VERSION = "creator-follow-up-v1"

const followUpSchema = z.object({
  /** Subject lines matter most here: this is the second time they have seen her name. */
  subject: z.string().describe("Subject line. Reuse the original thread's subject unless there is a real reason not to, since a new subject reads as a new cold email."),
  body: z
    .string()
    .describe("The complete email, ready to send. Plain text, no markdown, no placeholder brackets except a signature line."),
  /** Her eyes only: why this one is shaped the way it is. */
  approach: z.string().describe("One sentence on what this follow-up is doing and why, for the creator, not for the brand."),
  /** Deliberately not sent: the honest read on whether this is still live. */
  read: z
    .string()
    .describe(
      "One blunt sentence on what the silence probably means and what she should expect. Never optimistic by default.",
    ),
})

export type FollowUpDraft = {
  subject: string
  body: string
  approach: string
  read: string
  kind: "follow_up" | "breakup"
  /** Position in the ladder, 1-indexed. */
  step: number
}

/**
 * The three jobs, in order.
 *
 * They widen in gap and narrow in ask. The last one converts best of the three,
 * which is counterintuitive until you notice it is the only one that makes "no"
 * as easy to send as "yes", and a brand that has been avoiding a decision will
 * take the easy option gratefully.
 */
const LADDER: Array<{ kind: "follow_up" | "breakup"; brief: string }> = [
  {
    kind: "follow_up",
    brief: `FOLLOW-UP 1 of 3. A short bump, roughly a week after the reply.

Its only job is to resurface the thread. Assume the email was read and deprioritised, not missed.
- Under 70 words. It should be readable in the preview pane without opening it.
- Add exactly one thing that was not in the first email: a post that has since performed, a development in their category, a concrete idea for their brief. If there is genuinely nothing new to add, keep it to two sentences and do not manufacture something.
- Do not restate the pitch. Do not re-quote the price. Do not re-list the deliverables.
- One question, answerable in one word or one line.`,
  },
  {
    kind: "follow_up",
    brief: `FOLLOW-UP 2 of 3. Roughly two weeks after the first chase.

Its job is to give them a new reason to look, because the old reason has now failed twice.
- Under 120 words.
- Lead with the new angle, not with the thread. Something has changed since the first email: a piece of her work, something in their market, a shift in the story she is covering.
- This is the one place to re-anchor the money, and only if the silence started after they saw the number. Restate what the fee covers and name one cheaper scope they could take instead. Brands go quiet on price far more often than they say so.
- Still one ask.`,
  },
  {
    kind: "breakup",
    brief: `FOLLOW-UP 3 of 3. The close. Roughly three weeks after the second.

Its job is to end the thread cleanly, and it converts better than either email above it, because it is the only one that makes "no" as easy to send as "yes".
- Under 70 words.
- Say plainly that she is assuming the timing is not right and is closing the file, and that they should come back whenever it changes.
- No guilt, no last pitch, no "before I go, here is one more thing". The absence of a pitch is what makes this work.
- Leave one door open in one clause, then stop.
- It must be genuinely fine for them to never reply. If reading it back feels passive-aggressive, rewrite it.`,
  },
]

const SYSTEM_PROMPT = `You write follow-up emails for a creator chasing a brand that has gone quiet.

Read the original inbound brief, what she replied, what she quoted, and how long the silence has run. Then write the follow-up for the position in the ladder you are given.

Absolute rules:
- Never apologise for following up. Not "sorry to chase", not "sorry for the second email", not "I know you are busy".
- Never write "just checking in", "just following up", "bumping this", "circling back", "touching base", "wanted to float this again", or any variant. These phrases signal that the email contains nothing new, which is usually true and is exactly the problem.
- Never guilt them. No "I have not heard back", no "I assume you are not interested", no counting the days at them.
- Never re-attach or re-paste the original pitch. They have it.
- Never invent a metric, a rate, a past client, or an event that has not happened. If nothing has changed since the last email, say less rather than inventing a reason to write.
- Quote money only from the supplied rate card, and only where the ladder brief says to.
- Never use an em dash or an en dash anywhere. Use a full stop, a comma, a colon or a new sentence. The creator will not send an email containing one.
- Plain text. No markdown, no bullets unless the ladder brief calls for a list, no placeholder brackets except a signature line.
- Warm, direct, short. She is a specialist with a real audience writing to a peer, not a supplier chasing an invoice.

The single test: would a busy person reading this on a phone feel it was worth the eleven seconds. If the email contains no new information and makes no easy ask, it fails.`

export type FollowUpResult =
  | { ok: true; draft: FollowUpDraft; message: ConversationMessage; tokens: number }
  | { ok: false; error: string }

function historyBlock(conversation: CreatorConversation): string {
  return conversation.messages
    .map((m) => {
      const label = m.kind === "reply" ? "Her reply" : m.kind === "breakup" ? "Her close" : "Her follow-up"
      const when = m.sent_at ? `sent ${m.sent_at.slice(0, 10)}` : "drafted, not sent"
      return `--- ${label} (${when}) ---\n${m.body}`
    })
    .join("\n\n")
}

export async function draftFollowUp(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<FollowUpResult> {
  const conversation = await loadConversation(supabase, userId, conversationId)
  if (!conversation) return { ok: false, error: "That conversation no longer exists." }

  if (conversation.state !== "open") {
    return { ok: false, error: `This conversation is marked ${conversation.state}. Reopen it to chase again.` }
  }

  // Chasing an email that was never sent is the worst message a brand can get,
  // so the unsent case is refused rather than handled.
  if (!conversation.sent_at) {
    return {
      ok: false,
      error: "Mark the first email as sent before drafting a follow-up. Nothing has gone out yet.",
    }
  }

  const step = followUpsSent(conversation)
  if (step >= MAX_FOLLOW_UPS) {
    return {
      ok: false,
      error: "Three follow-ups have gone out. A fourth costs more in goodwill than it can win back.",
    }
  }

  const rung = LADDER[step]
  const silent = daysSilent(conversation) ?? 0

  const [worthContext, canon, posts, { settings }] = await Promise.all([
    loadWorth(supabase, userId),
    loadCreatorCanon(supabase, userId),
    loadCreatorPosts(supabase, userId),
    loadCreatorSettings(supabase, userId),
  ])

  const worth = worthContext.worth
  const cardBlock = worth
    ? `RATE CARD (quote from this only, and only where the brief above permits it). Base ${worth.currency} ${worth.base_fee.toLocaleString()} for one video, organic, one platform:

${lineItemsBlock(priceLineItems(worth.base_fee, settings.rate_overrides), worth.currency)}`
    : "RATE CARD: not derivable. Do not name a figure."

  // What she has published since the reply went out. This is the only honest
  // source of "something new to say", and without it the model reaches for
  // invented urgency instead.
  const sinceSent = posts
    .filter((p) => p.posted_at && conversation.sent_at && p.posted_at > conversation.sent_at)
    .filter((p) => typeof p.metrics?.views === "number")
    .sort((a, b) => (b.metrics?.views ?? 0) - (a.metrics?.views ?? 0))
    .slice(0, 3)
    .map((p) => `- "${p.caption?.slice(0, 120) ?? "untitled"}" (${p.metrics?.views?.toLocaleString()} views)`)
    .join("\n")

  const newsBlock = sinceSent
    ? `PUBLISHED SINCE THAT EMAIL WENT OUT (the only permissible source of "something new"):\n${sinceSent}`
    : "PUBLISHED SINCE THAT EMAIL WENT OUT: nothing with metrics yet. Do not claim anything new has happened."

  const voiceBlock = canon?.voice
    ? `VOICE PROFILE (for register, not slang): ${JSON.stringify(canon.voice)}`
    : "VOICE PROFILE: not derived."

  try {
    const { object, usage } = await creatorGenerateObject({
      schema: followUpSchema,
      system: SYSTEM_PROMPT,
      prompt: `${rung.brief}

SILENCE: ${silent} days since the last email she sent.

THE ORIGINAL INBOUND BRIEF
"""
${conversation.inbound.slice(0, 4000)}
"""

WHAT THEY WANTED: ${conversation.what_they_want ?? "not recorded"}
WHAT SHE QUOTED: ${
        conversation.quoted_total
          ? `${conversation.currency ?? "USD"} ${conversation.quoted_total.toLocaleString()}`
          : "no figure recorded"
      }

THE THREAD SO FAR
${historyBlock(conversation)}

${newsBlock}

${cardBlock}

${voiceBlock}

Write the follow-up.`,
      agent: "deals.follow-up",
      log: { supabase, userId },
      maxOutputTokens: 8000,
    })

    // The prompt asks for no dashes; this makes it true. Same reasoning as the
    // brief reply: a prompt is a request, and the one that slips through is the
    // one that goes out without being reread.
    const draft: FollowUpDraft = {
      subject: withoutDashes(object.subject),
      body: withoutDashes(object.body),
      approach: withoutDashes(object.approach),
      read: withoutDashes(object.read),
      kind: rung.kind,
      step: step + 1,
    }

    const message = await appendMessage(supabase, userId, conversationId, rung.kind, draft.body)
    if (!message) return { ok: false, error: "Drafted the follow-up but could not save it to the thread." }

    return { ok: true, draft, message, tokens: usage.totalTokens }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not draft a follow-up." }
  }
}

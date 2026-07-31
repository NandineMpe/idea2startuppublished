import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { creatorGenerateObject } from "@/lib/creator/ai/claude"
import { loadCreatorPosts } from "@/lib/creator/load-corpus"

/**
 * Open threads from the creator's own back catalogue.
 *
 * Every post they have published is a claim made on a date about something that
 * was, at that moment, unfinished. A firm had just been caught, a case had just
 * been filed, a rule had just been proposed. Then the feed moved on, and so did
 * everyone covering it.
 *
 * That abandonment is the opportunity. The creator already has standing on each
 * of these stories because they covered it first, and nobody else is going back
 * to check. "I told you about this eight months ago, here is what actually
 * happened" is a piece only they can make, and it is primary work rather than
 * commentary, because answering it means reading the docket rather than reading
 * a headline.
 */

export const THREAD_OPEN_PROMPT_VERSION = "creator-threads-open-v1"

const threadSchema = z.object({
  // Flat and newline-delimited: nested objects and stacked arrays make this
  // model emit tool-call markup into the JSON and abandon the rest.
  subjects: z
    .string()
    .describe("Each trackable subject, ONE PER LINE, prefixed '1: '. Name the specific party and event, not the theme."),
  queries: z
    .string()
    .describe("A search query for each subject, ONE PER LINE, prefixed with the matching number. Written for primary sources: name the firm, the regulator, the case, the docket, the standard. Not a headline."),
  known: z
    .string()
    .describe("What was known at the time, ONE PER LINE, prefixed with the matching number. One or two sentences of fact."),
  questions: z
    .string()
    .describe("What would count as this having moved, ONE PER LINE prefixed with the matching number, with several questions on one line separated by ' | '. Be concrete: a ruling, a sanction, a final rule, a restatement, a resignation, a refund."),
  post_indexes: z
    .string()
    .describe("The index of the post each subject came from, ONE PER LINE, prefixed with the matching number, as a bare number."),
})

const SYSTEM_PROMPT = `You are opening files on stories that are not over.

You are given a creator's published posts with dates. Your job is to find the ones that described something UNFINISHED, and turn each into a thread that can be checked later.

What makes a good thread:
- A named party and a specific event: a firm was caught, a case was filed, a regulator proposed something, a company promised something, a claim was disputed.
- A state that can change: litigation resolves, rules get finalised or dropped, sanctions land, reports get withdrawn or reinstated, promised products ship or do not, people resign.
- Checkable in a public document. If the only way to know what happened is to ask someone privately, it is not a thread.

What is NOT a thread:
- An opinion, an explainer, or a general trend. "AI is changing audit" has no state to check.
- Something already fully resolved at the time of posting, with nothing outstanding.
- Anything where you cannot name the party.

Rules:
- The query must be written for primary sources: dockets, filings, regulator publications, standards bodies. Name the entity exactly as a filing would. "Deloitte Australia report refund" is a good query; "AI mistakes in consulting" is not.
- what_was_known must be what was true AT THE TIME, not what you assume happened since. You do not know what happened since; that is the point of the thread.
- open_questions must be answerable yes or no by a document. "Did the regulator sanction the firm" is good. "Is the industry changing" is not.
- Prefer threads where the creator was early. Those are the ones where going back is strongest for them.
- Fewer, better threads. Six is plenty. A thread nobody will ever be able to close is noise.`

function toIndexed(value: string, limit = 12): Map<number, string[]> {
  const grouped = new Map<number, string[]>()
  for (const raw of value.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const match = line.match(/^(\d+)\s*[:.)-]\s*(.+)$/)
    if (!match) continue
    const idx = Number.parseInt(match[1], 10)
    if (idx < 1 || idx > limit) continue
    const list = grouped.get(idx) ?? []
    list.push(match[2].trim())
    grouped.set(idx, list)
  }
  return grouped
}

export type OpenThreadsResult =
  | { ok: true; opened: number; skipped: number; tokens: number }
  | { ok: false; error: string }

export async function openThreadsFromCorpus(
  supabase: SupabaseClient,
  userId: string,
): Promise<OpenThreadsResult> {
  const posts = await loadCreatorPosts(supabase, userId)
  if (!posts.length) return { ok: false, error: "No corpus to read yet." }

  const { data: existing } = await supabase
    .schema("creator")
    .from("creator_threads")
    .select("subject")
    .eq("user_id", userId)
    .is("deleted_at", null)

  const alreadyTracked = (existing ?? []).map((t) => `- ${t.subject}`).join("\n") || "- none"

  // Oldest first: a post from a year ago has had time to develop, which is
  // exactly what makes it worth reopening. The newest posts are still the news.
  const ordered = [...posts].sort(
    (a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime(),
  )

  const postList = ordered
    .map(
      (p, i) =>
        `[${i}] ${new Date(p.posted_at).toISOString().slice(0, 10)}: ${(p.caption ?? "").slice(0, 200)}\n     ${(p.transcript ?? "").slice(0, 700)}`,
    )
    .join("\n")

  try {
    const { object, usage } = await creatorGenerateObject({
      schema: threadSchema,
      system: SYSTEM_PROMPT,
      prompt: `THE CREATOR'S PUBLISHED POSTS (oldest first, numbered):\n${postList}\n\nALREADY TRACKED, do not repeat:\n${alreadyTracked}\n\nWhich of these described something that was not over? Open a file on each.`,
      maxOutputTokens: 20000,
    })

    const subjects = toIndexed(object.subjects)
    const queries = toIndexed(object.queries)
    const known = toIndexed(object.known)
    const questions = toIndexed(object.questions)
    const postIdx = toIndexed(object.post_indexes)

    let opened = 0
    let skipped = 0

    for (const [idx, subjectLines] of subjects) {
      const subject = subjectLines[0]
      const query = queries.get(idx)?.[0]
      const wasKnown = known.get(idx)?.[0]
      if (!subject || !query || !wasKnown) {
        skipped++
        continue
      }

      const postIndex = Number.parseInt(postIdx.get(idx)?.[0] ?? "", 10)
      const post = Number.isInteger(postIndex) ? ordered[postIndex] : undefined

      const { error } = await supabase
        .schema("creator")
        .from("creator_threads")
        .insert({
          user_id: userId,
          subject,
          query,
          origin: "corpus",
          origin_ref: post?.id ?? null,
          // The date the creator covered it, not today. Everything the check
          // searches is dated after this, so getting it wrong either floods the
          // thread with things it already knew or hides the developments.
          anchor_date: post?.posted_at ?? new Date().toISOString(),
          what_was_known: wasKnown,
          open_questions: (questions.get(idx)?.[0] ?? "")
            .split("|")
            .map((q) => q.trim())
            .filter(Boolean),
        })
      if (error) {
        skipped++
        continue
      }
      opened++
    }

    return { ok: true, opened, skipped, tokens: usage.totalTokens }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not open threads." }
  }
}

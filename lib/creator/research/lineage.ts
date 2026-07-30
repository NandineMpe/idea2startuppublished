import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { sweepTopicAcrossLanes } from "./lanes"

/**
 * Lineage — what a story is the latest instance of.
 *
 * The dossier answers "what happened this week". This answers the question
 * underneath it: what came before, what research it rests on, and what is
 * genuinely new versus what is the same argument returning in new clothes.
 *
 * Deliberately expensive and on demand. It runs a fresh multi-lane search for
 * historical antecedents and prior research, then reasons over that plus the
 * story's own receipts — so it is not the model recalling history from memory,
 * which is exactly where fabricated dates come from.
 */

export const LINEAGE_PROMPT_VERSION = "creator-lineage-v1"

const lineageSchema = z.object({
  timeline: z
    .array(
      z.object({
        period: z.string().describe('When, as precisely as the evidence supports: "1983", "late 1990s", "2016-2019".'),
        event: z.string().describe("What happened then, concretely — a named programme, paper, ruling, product or policy."),
        relevance: z.string().describe("Why it matters to the current claim. What pattern does it establish?"),
        verify: z.string().describe("What the creator should search to confirm this independently. Be specific."),
        confidence: z.enum(["documented", "well_known", "uncertain"]).describe(
          "documented = supported by a provided source; well_known = widely established but not in the sources here; uncertain = plausible but should be checked before airing.",
        ),
      }),
    )
    .max(7)
    .describe("Oldest first. The chain this story sits at the end of."),
  building_on: z.string().describe("The specific prior thing this is an increment of, named plainly."),
  recurring_question: z
    .string()
    .describe("The question that keeps resurfacing across the timeline and still is not settled."),
  whats_actually_new: z
    .string()
    .describe("The honest delta. If little is genuinely new, say so — that is often the stronger take."),
  whats_repeating: z.string().describe("The part being presented as new that has happened before."),
  research_base: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().nullable(),
        what_it_shows: z.string().describe("The specific finding, not a summary of the abstract."),
      }),
    )
    .max(6)
    .describe("Papers, studies or books underneath the claim — drawn from the provided sources only."),
})

export type StoryLineage = z.infer<typeof lineageSchema>

const SYSTEM_PROMPT = `You are a research desk building the historical spine of a story for a creator whose whole editorial position is that nothing starts from zero — that every development is unfolding on top of an earlier timeline, and the interesting work is showing what that timeline is.

Your job is not to summarise the news. It is to establish what this is the latest instance of.

Rules:
- Build the timeline oldest first. Each entry needs a concrete, checkable anchor: a named programme, paper, ruling, product, standard or policy. "Growing interest in X" is not an entry.
- Mark confidence honestly. Use "documented" only when a provided source supports it. Use "well_known" for established history not in these sources. Use "uncertain" when it is plausible but you are not certain — never dress a guess as a fact. A wrong date said on camera is worse than a missing one.
- Every timeline entry needs a "verify" string specific enough to search. Not "look up AI literacy" but "search for the 1983 ACM curriculum recommendations on computer literacy".
- "whats_repeating" matters as much as "whats_actually_new". The strongest version of this creator's take is usually that the cycle has run before and the same question went unanswered.
- research_base must come from the provided sources. Do not invent citations, DOIs or URLs. An empty list is acceptable and far better than a fabricated one.
- Prefer precision over reach: five well-anchored entries beat seven where two are guesses.`

/** Search terms that surface antecedents rather than this week's coverage. */
function historyQueries(thesis: string, topic: string): string[] {
  const base = topic.trim() || thesis.slice(0, 60)
  return [
    `history of ${base}`,
    `${base} origins early research`,
    `${base} prior attempts lessons`,
  ]
}

export type LineageResult = { ok: true; lineage: StoryLineage; tokens: number } | { ok: false; error: string }

export async function deriveLineageForStory(
  supabase: SupabaseClient,
  userId: string,
  storyId: string,
): Promise<LineageResult> {
  const { data: story, error } = await supabase
    .schema("creator")
    .from("creator_stories")
    .select("id,thesis,why_now,why_you,receipts,signal_ids,suggested_pillar_id")
    .eq("id", storyId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!story) return { ok: false, error: "Story not found." }

  await supabase
    .schema("creator")
    .from("creator_stories")
    .update({ lineage_state: "running" })
    .eq("id", storyId)

  // The signals behind the story, for the current-state half of the picture.
  const { data: signals } = await supabase
    .schema("creator")
    .from("creator_signals")
    .select("title,url,snippet,lane,topics")
    .in("id", story.signal_ids ?? [])
    .limit(12)

  // A fresh historical sweep: papers and books carry antecedents that a news
  // search never will, which is the whole reason this is a separate pass.
  const topic = (signals ?? [])[0]?.topics?.[0] ?? ""
  const historical = (
    await Promise.all(
      historyQueries(story.thesis, topic).map((q) =>
        sweepTopicAcrossLanes(q, "core", 24 * 365 * 5)
          .then((outcome) => outcome.signals)
          .catch(() => []),
      ),
    )
  )
    .flat()
    .filter((s) => s.lane === "papers" || s.lane === "books")
    .slice(0, 24)

  const currentBlock = (signals ?? [])
    .map((s, i) => `[current ${i}] (${s.lane}) ${s.title}${s.url ? ` <${s.url}>` : ""}\n    ${(s.snippet ?? "").slice(0, 240)}`)
    .join("\n")

  const historyBlock = historical.length
    ? historical
        .map(
          (s, i) =>
            `[hist ${i}] (${s.lane}, ${s.published_at.toISOString().slice(0, 10)}) ${s.title} <${s.url}>\n    ${(s.body ?? "").slice(0, 240)}`,
        )
        .join("\n")
    : "(no historical sources retrieved — rely on well_known confidence and mark uncertainty honestly)"

  const receiptBlock = JSON.stringify(story.receipts ?? [])

  try {
    const { object, usage } = await creatorGenerateObject({
      schema: lineageSchema,
      system: SYSTEM_PROMPT,
      prompt: `THE STORY\nThesis: ${story.thesis}\nWhy now: ${story.why_now ?? "—"}\nWhy this creator: ${story.why_you ?? "—"}\nReceipts: ${receiptBlock}\n\nCURRENT SIGNALS\n${currentBlock || "(none)"}\n\nHISTORICAL AND RESEARCH SOURCES\n${historyBlock}\n\nBuild the lineage: what is this the latest instance of?`,
      maxOutputTokens: 6000,
    })

    const { error: saveError } = await supabase
      .schema("creator")
      .from("creator_stories")
      .update({
        lineage: object,
        lineage_state: "done",
        lineage_derived_at: new Date().toISOString(),
        model_version: CREATOR_MODEL_VERSION,
      })
      .eq("id", storyId)
    if (saveError) return { ok: false, error: saveError.message }

    return { ok: true, lineage: object, tokens: usage.totalTokens }
  } catch (e) {
    await supabase
      .schema("creator")
      .from("creator_stories")
      .update({ lineage_state: "failed" })
      .eq("id", storyId)
    return { ok: false, error: e instanceof Error ? e.message : "Lineage derivation failed." }
  }
}

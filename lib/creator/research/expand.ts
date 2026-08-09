import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { sweepTopicAcrossLanes, type LaneSignal } from "./lanes"
import { gateFailure } from "./synthesise"

/**
 * Expand a creator's own idea into a dossier.
 *
 * The Researcher decides what to look at from the canon. This is the other
 * direction: the creator names a lead, a firm, a hunch, and the desk goes and
 * finds out whether it stands up.
 *
 * The honesty rule matters more here than in the scheduled sweep. A seeded idea
 * arrives with the creator already invested in it, so the pass must be able to
 * come back and say the evidence is not there, rather than assembling something
 * that sounds supported. What it finds is recorded as receipts; what it cannot
 * find is stated.
 */

export const EXPAND_PROMPT_VERSION = "creator-expand-v1"

const expandedSchema = z.object({
  thesis: z
    .string()
    .describe("The claim the evidence actually supports, which may be narrower or different from the seed."),
  synthesis_kind: z.enum(["connection", "contradiction", "second_order", "trend_break", "own_content"]),
  move: z.enum(["consolidate", "expand"]),
  // Flat, newline-delimited: nested objects and stacked arrays make this model
  // emit tool-call markup into the JSON and abandon the rest of the object.
  receipt_indexes: z
    .string()
    .describe("Indexes from the numbered source list that support the thesis, ONE PER LINE, as bare numbers."),
  receipt_quotes: z
    .string()
    .describe("The specific fact, number or quote taken from each cited source, ONE PER LINE, in the same order as receipt_indexes."),
  why_now: z.string(),
  named_actor: z.string().describe("Who DID something. A document is not an actor. Empty string if nobody acted."),
  stakes: z
    .string()
    .describe("Who loses, who is embarrassed, who has to change what, and by when. From the sources, not speculation."),
  open_question: z.string().describe("What this genuinely cannot answer from its own sources."),
  hook_line: z
    .string()
    .describe("One sentence, sayable to someone who reads nothing. No acronyms, no document names, no dates."),
  unknowns: z.string().describe("What you do not know yet. The hole in this as it stands."),
  kill_reason: z.string().describe("The strongest honest argument for dropping this, argued as its opponent would."),
  primary_emotion: z.enum(["knowledge", "amusement", "jolt", "admiration", "inspiration", "craving", "calm"]),
  output_format: z.enum(["script", "written", "artifact"]),
  angle: z.string().describe("A suggested opening in the creator's voice."),
  evidence_verdict: z
    .enum(["well_supported", "thin", "not_supported"])
    .describe("How well the retrieved sources actually back the seed. Be honest: thin and not_supported are useful answers."),
  what_is_missing: z
    .string()
    .describe("What evidence would be needed to make this airable, if anything. Say plainly when the idea does not hold up."),
})

const SYSTEM_PROMPT = `You are a research desk investigating a lead the creator brought you. They have named a subject, a firm, a claim or a hunch, and your job is to find out whether it stands up.

You are given sources retrieved for that lead. Work only from them.

Rules:
- Do not assume the seed is correct. If the sources do not support it, say so through evidence_verdict and what_is_missing. A creator who airs an unsupported claim about a named firm carries real risk, and the whole value of this desk is that it says when the evidence is not there.
- The thesis must be what the evidence supports, not what the seed hoped for. Narrowing it is a good outcome.
- Receipts must be concrete and drawn from the numbered sources: a figure, a named party, a dated action. Never invent a source or a quote.
- If the sources are only tangentially about the subject, that is "not_supported", not "thin".
- what_is_missing should name the specific document, filing, statement or dataset that would settle it.
- Write "angle" in the creator's voice when a voice profile is supplied.`

export type ExpandResult =
  | { ok: true; storyId: string; verdict: string; receipts: number; tokens: number }
  | { ok: false; error: string }

function toLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*–]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
}

export async function expandCreatorSeed(
  supabase: SupabaseClient,
  userId: string,
  seed: string,
): Promise<ExpandResult> {
  const trimmed = seed.trim()
  if (trimmed.length < 6) {
    return { ok: false, error: "Give the desk a bit more to work with." }
  }

  const [{ data: canon }, laneOutcome] = await Promise.all([
    supabase
      .schema("creator")
      .from("creator_canon")
      .select("version,pillars,voice,topics")
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // A wide window: a seed is often about something that happened a while ago,
    // unlike the daily sweep which is looking for what moved this week.
    sweepTopicAcrossLanes(trimmed, "core", 24 * 365).catch(() => ({ signals: [], errors: [] })),
  ])

  const signals: LaneSignal[] = laneOutcome.signals.slice(0, 40)

  if (!signals.length) {
    return {
      ok: false,
      error:
        "Nothing found on that. Try naming it more specifically, or add the firm, the case or the date you have in mind.",
    }
  }

  const sourceList = signals
    .map(
      (s, i) =>
        `[${i}] lane=${s.lane} (${s.published_at.toISOString().slice(0, 10)}) ${s.title} <${s.url}>\n    ${(s.body ?? "").slice(0, 300)}`,
    )
    .join("\n")

  const canonBlock = canon
    ? `CREATOR CANON v${canon.version}\nPillars: ${JSON.stringify(canon.pillars)}\nVoice: ${JSON.stringify(canon.voice)}`
    : "CREATOR CANON: not derived yet."

  try {
    const { object, usage } = await creatorGenerateObject({
      schema: expandedSchema,
      system: SYSTEM_PROMPT,
      prompt: `THE CREATOR'S LEAD:\n"""\n${trimmed.slice(0, 2000)}\n"""\n\nRETRIEVED SOURCES (numbered):\n${sourceList}\n\n${canonBlock}\n\nDoes this stand up? Build the dossier, or say why it does not.`,
      agent: "research.expand",
      log: { supabase, userId },
      maxOutputTokens: 32000,
    })

    const indexes = toLines(object.receipt_indexes)
      .map((n) => Number.parseInt(n, 10))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < signals.length)
    const quotes = toLines(object.receipt_quotes)

    const receipts = indexes.map((idx, i) => ({
      signal_id: signals[idx].source_item_id,
      url: signals[idx].url,
      title: signals[idx].title,
      quote: quotes[i] ?? "",
    }))

    // Seeded stories go to the watchlist when the evidence does not hold, so a
    // weak lead is visible as weak rather than sitting alongside verified work.
    const state = object.evidence_verdict === "not_supported" ? "watchlist" : "proposed"

    const { data: storyRow, error } = await supabase
      .schema("creator")
      .from("creator_stories")
      .insert({
        user_id: userId,
        state,
        thesis: object.thesis,
        synthesis_kind: object.synthesis_kind,
        move: object.move,
        receipts,
        signal_ids: [],
        why_now: object.why_now,
        named_actor: object.named_actor,
        stakes: object.stakes,
        open_question: object.open_question,
        hook_line: object.hook_line,
        unknowns: object.unknowns,
        kill_reason: object.kill_reason,
        primary_emotion: object.primary_emotion,
        output_format: object.output_format,
        // Recorded, never enforced. The candidate gate kills automated
        // candidates because nobody asked for them; this lead exists because the
        // creator asked for it, and silently binning what they asked to have
        // investigated would make the desk feel broken. Say what is weak and let
        // them decide.
        gate_failure: gateFailure({
          named_actor: object.named_actor,
          stakes: object.stakes,
          unknown_terms: "",
          open_question: object.open_question,
          hook_line: object.hook_line,
          thesis: object.thesis,
          angle: object.angle,
          why_now: object.why_now,
        }),
        angle: object.angle,
        canon_version: canon?.version ?? null,
        model_version: CREATOR_MODEL_VERSION,
        prompt_version: EXPAND_PROMPT_VERSION,
      })
      .select("id")
      .single()
    if (error) return { ok: false, error: error.message }

    // The verdict rides on the Desk item so a thin lead cannot be approved
    // without the creator seeing that it is thin.
    if (state === "proposed") {
      const { data: workRow } = await supabase
        .schema("creator")
        .from("creator_work")
        .insert({
          user_id: userId,
          kind: "insight",
          state: "proposed",
          autonomy: "approve",
          title: object.hook_line || object.thesis,
          body: `${object.thesis}\n\nWhy now: ${object.why_now}\n\nOpen question: ${object.open_question}`,
          rationale:
            object.evidence_verdict === "thin"
              ? `Evidence is thin. ${object.what_is_missing}`
              : object.stakes,
          provenance: {
            agent: "researcher (your lead)",
            canon_version: canon?.version ?? 0,
            source_post_ids: [],
            story_id: storyRow.id,
            seeded_by_creator: true,
          },
        })
        .select("id")
        .single()

      if (workRow) {
        await supabase
          .schema("creator")
          .from("creator_stories")
          .update({ work_item_id: workRow.id })
          .eq("id", storyRow.id)
      }
    }

    return {
      ok: true,
      storyId: storyRow.id,
      verdict: object.evidence_verdict,
      receipts: receipts.length,
      tokens: usage.totalTokens,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not work the lead." }
  }
}

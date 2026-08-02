import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"

/**
 * The Writer: drafts a piece against a derived format in the creator's derived
 * voice, with real posts as evidence of what their openers actually sound
 * like. Commissioned automatically when the creator approves a Researcher
 * story, or directly with a brief. Output joins the Next Five queue.
 */

export const WRITER_PROMPT_VERSION = "creator-writer-v1"

const draftSchema = z.object({
  premise: z
    .string()
    .describe(
      "Two or three sentences saying what this piece argues and why it is worth the creator's time. Written for them reading their own queue cold, not for the audience. Never a restatement of the point.",
    ),
  // Four flat strings rather than an array of section objects: nested shapes in
  // this schema make the model emit tool-call markup into the JSON.
  point: z
    .string()
    .describe(
      "THE CONCLUSION, FIRST. One to three spoken sentences stating the finding flat out. No question, no tease, no 'here is why'. The opening sentence is the hook and must be able to stand alone as a claim.",
    ),
  trigger: z
    .string()
    .describe(
      "Why this is on screen today. Name the dated thing: the ruling, the filing, the consultation that closes, the report that was withdrawn. One to three sentences.",
    ),
  analysis: z
    .string()
    .describe(
      "The unpack. Facts and evidence from the receipts, in the order that builds the argument. The longest section. Written to be spoken, no headings.",
    ),
  loop: z
    .string()
    .describe(
      "The close. It restates the point in stronger terms now the evidence is in, and its final words must run straight into the first words of the point, so a replay sounds continuous. Two to four sentences.",
    ),
  format_id: z.string().nullish().describe("The id of the derived format used, or null when none fits."),
  estimated_duration_seconds: z.number().int().min(10).max(600),
  title: z.string().describe("Working title for the queue."),
})

const SYSTEM_PROMPT = `You are the staff writer of a one-person creator's management agency. You draft short-form video scripts in the creator's own voice — the exemplar posts are the ground truth of how they open, pace and phrase; the voice profile is your style guide; never_says is a hard blocklist.

THE HOUSE STRUCTURE. Every script has four sections in this order, and it is not optional:

1. POINT. The conclusion, stated first and stated flat. Not a question, not "here is what nobody is telling you", not a promise that the answer is coming. Give the finding away in the first four seconds. A viewer who leaves immediately should still have learned the thing; the ones who stay are staying for the reasoning, and that is a far better audience than one held by suspense.

2. TRIGGER. Why this is on screen today rather than any other day. Name the dated event: the ruling, the filing, the comment period closing, the report withdrawn. Without this the piece is an essay and it will feel like one.

3. ANALYSIS. The unpack. Facts and evidence in the order that builds the argument, drawn from the receipts. This is the longest section and it is where the creator earns the claim they already made.

4. LOOP. The close. Restate the point, harder now the evidence is in, and land the final words so they run straight into the opening line. When the video replays, it should sound like one continuous sentence rather than a video ending and a video starting. That is the whole device: write the last line and the first line as a joined pair, and check they actually join.

The loop is the part most writers get wrong. It is not a summary and it is not a call to action. It is the same claim arriving with weight, positioned so the seam is invisible.

Rules:
- Sound like the exemplars, not like a copywriter. If the exemplars are casual and clipped, the script is casual and clipped.
- The house structure wins over any format structure in the canon. A derived format tells you the creator's phrasing and pacing within a section; it does not reorder the four.
- Never open the point with a throat-clear. No "let's talk about", no "so", no "here is something interesting". The first words are the claim.
- Facts and numbers must come from the brief's receipts. Invent nothing.
- Write for speech: short sentences, no headings, no hashtags in the talk-track.
- Where the brief carries a lineage, use it. A piece that says what this is the latest instance of, rather than treating it as new, is the difference between reporting a thing and explaining it. Name the earlier moment in the script where it earns its place; do not tack a history lesson on the end.
- The premise is for the creator, not the audience. They are scanning a queue of five and deciding what to shoot, so tell them what the piece argues and what makes it worth doing. Do not sell it to them.`

export type WriterResult = { work_id: string; tokens: number }

/**
 * The hook is the first sentence of the point, taken rather than written.
 *
 * It used to be its own generated field alongside a separate script, and
 * nothing tied them together: the card showed one opener while the talk track
 * began with another. Deriving it means what the creator reads on the card is
 * literally the first thing they will say.
 */
function openingLine(point: string): string {
  const first = point.trim().split(/(?<=[.!?])\s+/)[0] ?? point.trim()
  // A single unbroken sentence that runs long is still the opener; truncating
  // it would invent a line that appears nowhere in the script.
  return first.trim()
}

/** The spoken talk track. Blank lines between sections, no labels: this is read aloud. */
function assembleScript(parts: {
  point: string
  trigger: string
  analysis: string
  loop: string
}): string {
  return [parts.point, parts.trigger, parts.analysis, parts.loop]
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n")
}

export async function draftForUser(
  supabase: SupabaseClient,
  userId: string,
  args: { storyId?: string; brief?: string },
): Promise<WriterResult | null> {
  const [{ data: story }, { data: canon }] = await Promise.all([
    args.storyId
      ? supabase.schema("creator").from("creator_stories")
          // lineage included: what a story is the latest instance of is the
          // most useful thing on the dossier and the writer was never shown it.
          .select("id,thesis,angle,why_now,why_you,receipts,lineage,lineage_state,move,suggested_pillar_id,suggested_format_id,canon_version")
          .eq("id", args.storyId).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.schema("creator").from("creator_canon")
      .select("version,voice,formats,pillars")
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!story && !args.brief) return null

  // Exemplars: transcribed posts from the story's pillar first, best-performing otherwise.
  let exemplarQuery = supabase.schema("creator").from("creator_content")
    .select("id,caption,transcript,metrics")
    .eq("user_id", userId)
    .eq("transcript_status", "done")
    .order("posted_at", { ascending: false })
    .limit(4)
  if (story?.suggested_pillar_id) {
    exemplarQuery = exemplarQuery.eq("pillar_id", story.suggested_pillar_id)
  }
  let { data: exemplars } = await exemplarQuery
  if (!exemplars?.length) {
    const fallback = await supabase.schema("creator").from("creator_content")
      .select("id,caption,transcript,metrics")
      .eq("user_id", userId)
      .not("transcript", "is", null)
      .order("posted_at", { ascending: false })
      .limit(4)
    exemplars = fallback.data ?? []
  }

  const exemplarBlock = exemplars.length
    ? `EXEMPLARS (the creator's real posts — match this voice):\n${exemplars
        .map((p, i) => `--- exemplar ${i + 1} ---\n${(p.transcript ?? p.caption ?? "").slice(0, 500)}`)
        .join("\n")}`
    : "EXEMPLARS: none transcribed yet — write plainly and flag nothing fancy."

  const canonBlock = canon
    ? `VOICE PROFILE: ${JSON.stringify(canon.voice)}\nFORMATS (use format id when one fits): ${JSON.stringify(canon.formats)}`
    : "VOICE PROFILE: not derived yet."

  const lineage = story?.lineage as
    | { timeline?: Array<{ period: string; event: string; relevance: string }>; building_on?: string; whats_actually_new?: string; recurring_question?: string }
    | null
    | undefined

  const lineageBlock = lineage?.timeline?.length
    ? `WHAT THIS IS BUILDING ON:\n${lineage.timeline
        .map((t) => `- ${t.period}: ${t.event} (${t.relevance})`)
        .join("\n")}${lineage.building_on ? `\nBuilding on: ${lineage.building_on}` : ""}${
        lineage.whats_actually_new ? `\nActually new here: ${lineage.whats_actually_new}` : ""
      }${lineage.recurring_question ? `\nRecurring question: ${lineage.recurring_question}` : ""}`
    : ""

  const briefBlock = story
    ? `BRIEF (approved story dossier):\nThesis: ${story.thesis}\nAngle: ${story.angle ?? "—"}\nWhy now: ${story.why_now ?? "—"}\nWhy this creator: ${story.why_you ?? "—"}\nReceipts: ${JSON.stringify(story.receipts)}${lineageBlock ? `\n\n${lineageBlock}` : ""}`
    : `BRIEF:\n${args.brief}`

  const { object, usage } = await creatorGenerateObject({
    schema: draftSchema,
    system: SYSTEM_PROMPT,
    prompt: `${briefBlock}\n\n${canonBlock}\n\n${exemplarBlock}\n\nDraft the script.`,
    agent: "writer.draft",
    log: { supabase, userId },
    maxOutputTokens: 4000,
  })

  const { data: workRow, error } = await supabase
    .schema("creator")
    .from("creator_work")
    .insert({
      user_id: userId,
      kind: "draft",
      state: "proposed",
      autonomy: "approve",
      title: object.title,
      body: assembleScript(object),
      script_sections: {
        point: object.point.trim(),
        trigger: object.trigger.trim(),
        analysis: object.analysis.trim(),
        loop: object.loop.trim(),
      },
      premise: object.premise,
      rationale: story ? `Commissioned from approved story: ${story.thesis}` : "Commissioned from a direct brief.",
      provenance: {
        agent: "writer",
        canon_version: canon?.version ?? 0,
        source_post_ids: exemplars.map((p) => p.id),
        story_id: story?.id ?? null,
        model_version: CREATOR_MODEL_VERSION,
        prompt_version: WRITER_PROMPT_VERSION,
      },
      format_id: object.format_id,
      pillar_id: story?.suggested_pillar_id ?? null,
      hook: openingLine(object.point),
      estimated_duration_seconds: object.estimated_duration_seconds,
    })
    .select("id")
    .single()
  if (error) throw error

  return { work_id: workRow.id, tokens: usage.totalTokens }
}

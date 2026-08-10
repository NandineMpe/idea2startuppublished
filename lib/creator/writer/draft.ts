import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { extractsBlock, loadExtractsForSignals } from "@/lib/creator/load-extracts"

/**
 * The Writer: drafts a piece against a derived format in the creator's derived
 * voice, with real posts as evidence of what their openers actually sound
 * like. Commissioned automatically when the creator approves a Researcher
 * story, or directly with a brief. Output joins the Next Five queue.
 */

export const WRITER_PROMPT_VERSION = "creator-writer-v2"

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
      "THE CLAIM, FIRST, WITH THE VERDICT WITHHELD. One to three spoken sentences. Flat, bold, declarative, and sayable to someone who reads nothing. It asserts what is at stake; it does NOT resolve it, and it carries no numbers, no document names and no evidence. The opening sentence is the hook and must stand alone as a claim a viewer wants explained.",
    ),
  trigger: z
    .string()
    .describe(
      "Why this is on screen today. Name the dated thing: the ruling, the filing, the consultation that closes, the report that was withdrawn. One to three sentences.",
    ),
  analysis: z
    .string()
    .describe(
      "The unpack, released ON A CURVE: one new fact per beat, each beat earning the next. Never front-load the thesis. Facts and evidence from the receipts only. The longest section. Written to be spoken, no headings.",
    ),
  loop: z
    .string()
    .describe(
      "The close. It states the verdict the point only asserted, now that the evidence is in, and its final words must run straight into the first words of the point so a replay sounds continuous. The opening line must appear in it verbatim. Two to four sentences.",
    ),

  // Flat newline-delimited rather than arrays of objects: nested shapes in this
  // schema make the model emit tool-call markup into the JSON.
  show: z
    .string()
    .describe(
      "What is ON SCREEN for each claim, ONE PER LINE, prefixed '1: ', '2: '. Each line pairs a spoken claim with the thing that proves it: the document open at the paragraph, the tool running, the before and after. Never a glamour shot and never a stock image of an abstract idea. Every claim in the script needs a line here.",
    ),
  sell: z
    .string()
    .describe(
      "What this piece asks the viewer to buy, join or run, and the sentence in the analysis it lands on. Empty string if the piece sells nothing, which is the normal case for editorial.",
    ),
  ask: z
    .string()
    .describe(
      "One concrete action, one sentence, delivered on screen at the end rather than spoken. Not 'follow for more'. Something specific enough to do today: read the filing, run the artifact, check whether your own firm has filed.",
    ),
  format_id: z.string().nullish().describe("The id of the derived format used, or null when none fits."),
  estimated_duration_seconds: z.number().int().min(10).max(600),
  title: z.string().describe("Working title for the queue."),
})

const SYSTEM_PROMPT = `You are the staff writer of a one-person creator's management agency. You draft short-form video scripts in the creator's own voice — the exemplar posts are the ground truth of how they open, pace and phrase; the voice profile is your style guide; never_says is a hard blocklist.

THE HOUSE STRUCTURE. Every script has four sections in this order, and it is not optional:

1. POINT. The claim, stated first and stated flat, with the verdict withheld. It is a bold declarative sentence that names what is at stake and makes a viewer want the answer. It is not a question, not "here is what nobody is telling you", and not a promise that the answer is coming. It is also NOT the finding: no numbers, no document names, no evidence, no resolution. "Your working papers are about to stop being evidence" is the shape. "PwC's filing says their AI evidence is unverifiable and the regulator has not noticed" is the wrong shape, because it has spent everything in the first four seconds and left no reason to stay.

2. TRIGGER. Why this is on screen today rather than any other day. Name the dated event: the ruling, the filing, the comment period closing, the report withdrawn. Without this the piece is an essay and it will feel like one.

3. ANALYSIS. The unpack, and it is released ON A CURVE. One new fact per beat, each beat earning the next. Never front-load the thesis and never summarise where the argument is going. The brief was gated so that at most one unfamiliar term exists in the whole piece, and that gate exists precisely so this curve is possible: you can teach the one thing and then spend the rest of the section paying out evidence. This is the longest section and it is where the creator earns the claim they opened with.

4. LOOP. The close, and the verdict. The point asserted; this resolves. Land the final words so they run straight into the opening line, and the opening line must appear here verbatim. When the video replays, it should sound like one continuous sentence rather than a video ending and a video starting. That is the whole device: write the last line and the first line as a joined pair, and check they actually join. On a replay the opener stops sounding like a bold claim and starts sounding like a proven conclusion, which is the effect being bought.

The loop is the part most writers get wrong. It is not a summary and it is not a call to action. It is the claim arriving with weight, positioned so the seam is invisible.

SHOW, DO NOT TELL. Every claim in the script gets a line in "show" naming what is on screen while it is said: the document open at the paragraph, the tool running, the before and the after where the outcome is the proof. Hands on the thing. Ban any line that could belong to anyone; a sentence that would work in any video about AI is a sentence with nothing to show. Glamour shots are not use. This is the fix for a specific failure: this creator's two demo posts underperformed at 19,700 against 41,300 for news unpacks, and the cause was not that demos fail. Those two had no story earning the reveal and nothing at stake, so they were technique with nothing riding on it. A demo written against this structure is a different object.

PLACEMENT OF ANYTHING BEING SOLD. If the piece sells something, and that includes the creator's own products, their runnable artifact and any brand deal equally, it lands at 60 to 70 per cent of the way through. Late enough to be earned, early enough to be remembered. Front-loading it costs roughly 44 per cent of view rate. If the piece sells nothing, "sell" is an empty string, and that is the normal case for editorial. Do not manufacture a sell.

THE LANDING ASKS FOR SOMETHING. Peak and end are what get remembered and what decide what the viewer does next. The spoken track still ends on the verbatim callback, because the seam is worth more than a spoken CTA. The ask is delivered on screen after it. One sentence, concrete enough to do today. "Follow for more" is not an ask.

REGISTER. Calm and certain, not urgent. This material is dense and the audience is professional; frantic pacing fights the content and puts the creator in the same register as every other AI account. Confidence reads as calm. Vary the visuals fast, keep the voice steady.

Rules:
- Sound like the exemplars, not like a copywriter. If the exemplars are casual and clipped, the script is casual and clipped.
- The house structure wins over any format structure in the canon. A derived format tells you the creator's phrasing and pacing within a section; it does not reorder the four.
- Never open the point with a throat-clear. No "let's talk about", no "so", no "here is something interesting". The first words are the claim.
- Facts and numbers must come from the brief's receipts or the read documents. Invent nothing.
- Where a read document is supplied, quote it. Its quotes were verified against the source text character for character, which means the creator can say "this is what the filing says" and be telling the truth. That sentence is the entire product. A paraphrase of a verified quote throws away the only thing that separates this from commentary, so use the words.
- Write for speech: short sentences, no headings, no hashtags in the talk-track.
- Where the brief carries a lineage, use it. A piece that says what this is the latest instance of, rather than treating it as new, is the difference between reporting a thing and explaining it. Name the earlier moment in the script where it earns its place; do not tack a history lesson on the end.
- Write to a practitioner about their own work, never to or about the profession's governing bodies, and never about the rest of the commentary. These are banned outright: "nobody in the profession has", "the institutes should", "the industry is behind", "this is what we should be doing", "nobody is talking about this", "everyone is missing this", "this has gone unnoticed", "under the radar", "no outlet has covered this", "you probably have not heard about this". Never write a line whose point is that the creator got there before anyone else. The piece has to be interesting because of what is in it, not because of who has not said it, and a viewer who is told they are lucky to be hearing this hears an advert for the creator rather than an explanation of the thing. Being early buys the right to explain the mechanism first. It is not the subject.
- Talking down to the viewer reads as distrust, and distrust loses the room faster than boredom does.
- The brief carries a primary emotion. Serve that one and do not hedge across several. Where it is "knowledge", the reward you are writing toward is the viewer feeling they learned a specific thing they can repeat to a colleague, and that feeling is what earns the completion and the share.
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
          .select("id,thesis,angle,why_now,receipts,lineage,lineage_state,move,suggested_pillar_id,suggested_format_id,canon_version,stakes,open_question,hook_line,unknowns,primary_emotion,output_format,signal_ids")
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

  // The documents the research desk actually read, with verified quotes. This
  // is the difference between a script that says "the filing reportedly says"
  // and one that quotes the paragraph.
  const extracts = story
    ? [...(await loadExtractsForSignals(supabase, userId, (story.signal_ids as string[]) ?? [])).values()]
    : []
  const readBlock = extractsBlock(extracts)

  const briefBlock = story
    ? [
        "BRIEF (approved story dossier):",
        `Thesis: ${story.thesis}`,
        `Angle: ${story.angle ?? "—"}`,
        `Why now: ${story.why_now ?? "—"}`,
        // Stakes replaced why_you deliberately. The writer used to be handed an
        // argument for why the creator should bother, which is a note to the
        // creator, not material. Who loses and by when is material.
        `Stakes (who loses, who changes what, by when): ${story.stakes ?? "—"}`,
        `Open question this cannot answer: ${story.open_question ?? "—"}`,
        `Primary emotion to serve: ${story.primary_emotion ?? "knowledge"}`,
        story.hook_line ? `Hook the desk proposed (improve it or keep it): ${story.hook_line}` : null,
        `Receipts: ${JSON.stringify(story.receipts)}`,
        lineageBlock ? `\n${lineageBlock}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : `BRIEF:\n${args.brief}`

  const { object, usage } = await creatorGenerateObject({
    schema: draftSchema,
    system: SYSTEM_PROMPT,
    prompt: [briefBlock, readBlock, canonBlock, exemplarBlock, "Draft the script."]
      .filter(Boolean)
      .join("\n\n"),
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
        // Not part of the talk track. show feeds the visual planner, ask is
        // delivered on screen after the callback so the spoken seam survives,
        // and sell records where the pitch was placed so it can be checked.
        show: object.show.trim(),
        sell: object.sell.trim(),
        ask: object.ask.trim(),
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

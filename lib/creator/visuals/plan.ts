import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import type { StoryLineage, StoryReceipt, VisualPlanShape } from "@/lib/creator/types"

/**
 * The visual plan for a drafted piece.
 *
 * The reason this is worth doing here rather than in a generic tool: every
 * claim in one of these scripts is already attached to a primary document with
 * a URL. So the highest-credibility shot in short-form professional content is
 * free — the filing itself on screen, the paragraph highlighted, the docket
 * number legible. A planner without receipts has to fall back on stock footage
 * of someone typing.
 *
 * Two things the plan must not do. It must not invent an asset the creator
 * cannot make, which is why the toolkit is declared rather than assumed. And it
 * must not point a shot at a document that does not say what the beat claims,
 * which is why every capture carries the exact quote to find on the page.
 */

export const VISUAL_PROMPT_VERSION = "creator-visuals-v1"

const shotSchema = z.object({
  beat: z.string().describe("Which moment of the script this covers, quoting the first few words of the line it sits under."),
  seconds: z.number().int().min(1).max(30),
  on_screen_text: z
    .string()
    .describe("The words burned on screen for this beat. Six words or fewer. Empty string when the shot carries itself."),
  visual: z.string().describe("What is actually on screen, described so it could be handed to an editor."),
  asset_type: z
    .enum([
      "document_capture",
      "talking_head",
      "newspaper_motif",
      "timeline",
      "data_reveal",
      "screen_recording",
      "b_roll",
      "text_card",
    ])
    .describe("document_capture whenever the beat rests on a source. It is the most credible shot available and it costs nothing."),
  source_url: z
    .string()
    .describe("The receipt URL this shot is built from, verbatim from the numbered list. Empty string when the shot needs no source."),
  tool: z.string().describe("Which of the creator's declared tools makes this. Say 'camera' for talking head."),
})

const planSchema = z.object({
  cover_concept: z.string().describe("The thumbnail or first frame, described concretely."),
  cover_text: z.string().describe("The words on that first frame. Five words or fewer, readable at thumbnail size."),
  // Newline-delimited rather than stacked arrays: several string arrays in one
  // schema makes this model emit tool-call markup into the JSON.
  shots: z.array(shotSchema).min(4).max(14),
  captures: z
    .string()
    .describe(
      "Documents to screen-record or screenshot, ONE PER LINE, formatted 'URL :: what to highlight on the page'. Only URLs from the numbered receipts.",
    ),
  motif: z
    .string()
    .describe("One recurring visual device to reuse across this creator's series, so the pieces read as a body of work rather than one-offs."),
  sound: z
    .string()
    .describe("Voice, music and sound design notes, naming the creator's tools where they apply. Two or three lines."),
})

const SYSTEM_PROMPT = `You are the art director on a one-person creator's management agency, planning the visuals for a short-form vertical video that has already been written.

What makes this desk different from every other source of visual advice: the script is backed by primary documents, and you are given their URLs and the exact quotes taken from them. A regulator's filing on screen with the relevant paragraph highlighted is the most credible thing a professional audience can be shown, it takes thirty seconds to capture, and almost nobody does it because almost nobody has the document. Use it.

Craft rules for vertical short-form aimed at professionals:
- The first frame has to carry the claim on its own, because most of the audience never turns sound on and decides in about a second.
- Cut every two to four seconds. A static talking head past four seconds loses people regardless of what is being said.
- On-screen text is six words or fewer per beat. It is a headline, not a transcript. Burned-in captions run underneath separately and are assumed.
- One number per data beat, large, animated in. A chart with axes is a desktop object and does not survive a phone screen.
- Documents on screen must be legible: crop to the paragraph, highlight the line, never show a full page shrunk to fit.
- Nothing that misrepresents. Do not stage a document to look like a different document, do not add urgency the source does not have, and do not use a stock image of a real company's office as if it were the company.

Rules:
- Every shot must name a tool the creator actually has. You are given their toolkit. If a beat needs something outside it, say so in the visual description and pick the closest thing they can build.
- asset_type document_capture requires a source_url from the numbered receipts. Never invent a URL, never point a capture at a source that does not carry the claim.
- Where a lineage is supplied, the recurring-theme beats are the ones to give the newspaper or archival treatment, because that is literally what the material is: the same story surfacing across decades.
- The motif should be reusable and cheap. A creator who has to invent a new visual language every week stops making videos.
- Match the shot count to the script. Do not pad to a round number.
- The four sections want different rhythms. The point is one held frame with the claim on it, because it is the whole video for anyone who leaves. The trigger is the dated document, so it is a capture. The analysis carries the cuts. The loop returns to the point's framing.
- The loop only works if it looks continuous as well as sounding continuous. Compose the final shot so it rhymes with the first: same framing, same on-screen treatment, the words changed. A viewer watching twice should not see a seam.`

function toLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*–]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
}

export type VisualShot = z.infer<typeof shotSchema>

/** The stored plan. Shape lives in types.ts so the UI and the generator cannot drift. */
export type VisualPlan = VisualPlanShape

export type VisualPlanResult =
  | { ok: true; shots: number; captures: number; tokens: number }
  | { ok: false; error: string }

export async function planVisualsForDraft(
  supabase: SupabaseClient,
  userId: string,
  workId: string,
): Promise<VisualPlanResult> {
  const { data: draft } = await supabase
    .schema("creator")
    .from("creator_work")
    .select("id,title,premise,hook,body,script_sections,provenance,estimated_duration_seconds")
    .eq("id", workId)
    .eq("user_id", userId)
    .eq("kind", "draft")
    .maybeSingle()

  if (!draft) return { ok: false, error: "Draft not found." }
  if (!draft.body) return { ok: false, error: "This draft has no script to plan against yet." }

  const storyId = (draft.provenance as { story_id?: string } | null)?.story_id

  const [{ data: story }, { data: settings }, { data: canon }] = await Promise.all([
    storyId
      ? supabase
          .schema("creator")
          .from("creator_stories")
          .select("thesis,receipts,lineage")
          .eq("id", storyId)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .schema("creator")
      .from("creator_settings")
      .select("visual_tools")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .schema("creator")
      .from("creator_canon")
      .select("voice,formats")
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const receipts = ((story?.receipts ?? []) as StoryReceipt[]).filter((r) => r.url)
  const lineage = story?.lineage as StoryLineage | null

  const tools = (settings?.visual_tools ?? []) as Array<{ name?: string; url?: string; good_for?: string }>
  const toolBlock = tools.length
    ? `THE CREATOR'S TOOLKIT (use only these):\n${tools
        .map((t) => `- ${t.name}${t.url ? ` <${t.url}>` : ""}${t.good_for ? `: ${t.good_for}` : ""}`)
        .join("\n")}`
    : "THE CREATOR'S TOOLKIT: not declared. Assume only a camera, a phone screen recorder and a basic editor, and say plainly where a beat would be better with a tool they have not listed."

  const receiptBlock = receipts.length
    ? `RECEIPTS (the documents this script stands on — these are your capture targets):\n${receipts
        .map((r, i) => `[${i}] ${r.title}\n     quote: "${r.quote}"\n     url: ${r.url}`)
        .join("\n")}`
    : "RECEIPTS: none attached to this draft, so no document captures are available."

  const lineageBlock = lineage?.timeline?.length
    ? `LINEAGE (recurring theme across time — strong archival or newspaper material):\n${lineage.timeline
        .map((t) => `- ${t.period}: ${t.event}`)
        .join("\n")}`
    : ""

  try {
    const { object, usage } = await creatorGenerateObject({
      schema: planSchema,
      system: SYSTEM_PROMPT,
      prompt: `THE PIECE
Title: ${draft.title}
${draft.premise ? `Premise: ${draft.premise}` : ""}
Hook: ${draft.hook ?? "—"}
Target length: ${draft.estimated_duration_seconds ?? 60} seconds, vertical 9:16

${
  draft.script_sections
    ? `SCRIPT, in its four sections:

[POINT — the claim, stated first, verdict withheld]
${(draft.script_sections as { point: string }).point}

[TRIGGER — why today]
${(draft.script_sections as { trigger: string }).trigger}

[ANALYSIS — the evidence]
${(draft.script_sections as { analysis: string }).analysis}

[LOOP — the close and the verdict, written to run back into the point]
${(draft.script_sections as { loop: string }).loop}
${
  (draft.script_sections as { show?: string | null }).show
    ? `\n[SHOW — what the writer says must be on screen for each claim. Treat this as the brief, not a suggestion. Every claim needs something on screen: the document open at the paragraph, the tool running, the before and after. A glamour shot is not use, and a stock image of an abstract idea is worse than nothing.]\n${(draft.script_sections as { show?: string | null }).show}`
    : ""
}${
  (draft.script_sections as { ask?: string | null }).ask
    ? `\n[ASK — delivered as on-screen text after the final spoken line. It must not cover the callback, and it must be readable in under two seconds.]\n${(draft.script_sections as { ask?: string | null }).ask}`
    : ""
}`
    : `SCRIPT:
"""
${draft.body}
"""`
}

${receiptBlock}

${lineageBlock}

${toolBlock}

${canon?.voice ? `VOICE: ${JSON.stringify(canon.voice)}` : ""}

Plan the visuals.`,
      agent: "visuals.plan",
      log: { supabase, userId },
      maxOutputTokens: 20000,
    })

    // Only URLs that were actually offered. A capture pointed at an invented
    // page sends the creator hunting for a document that does not exist, and
    // the one pointed at the wrong document is worse: it looks like evidence.
    const allowed = new Set(receipts.map((r) => r.url as string))

    const captures = toLines(object.captures)
      .map((line) => {
        const [url, ...rest] = line.split("::")
        return { url: url.trim(), highlight: rest.join("::").trim() }
      })
      .filter((c) => allowed.has(c.url))

    const shots = object.shots.map((s) => ({
      ...s,
      source_url: allowed.has(s.source_url) ? s.source_url : "",
    }))

    const plan: VisualPlan = {
      cover_concept: object.cover_concept,
      cover_text: object.cover_text,
      shots,
      captures,
      motif: object.motif,
      sound: object.sound,
      generated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .schema("creator")
      .from("creator_work")
      .update({
        visual_plan: plan,
        provenance: {
          ...((draft.provenance as Record<string, unknown>) ?? {}),
          visual_model_version: CREATOR_MODEL_VERSION,
          visual_prompt_version: VISUAL_PROMPT_VERSION,
        },
      })
      .eq("id", workId)
      .eq("user_id", userId)

    if (error) return { ok: false, error: error.message }

    return { ok: true, shots: shots.length, captures: captures.length, tokens: usage.totalTokens }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not plan the visuals." }
  }
}

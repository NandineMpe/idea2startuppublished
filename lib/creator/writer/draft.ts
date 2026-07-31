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
  hook: z.string().describe("The opening line, in the creator's actual opener style. This is what gets judged first."),
  script: z.string().describe("The full talk-track for a short-form video, written to be spoken. Include beat markers as plain lines like [beat: receipt]."),
  format_id: z.string().nullish().describe("The id of the derived format used, or null when none fits."),
  estimated_duration_seconds: z.number().int().min(10).max(600),
  title: z.string().describe("Working title for the queue."),
})

const SYSTEM_PROMPT = `You are the staff writer of a one-person creator's management agency. You draft short-form video scripts in the creator's own voice — the exemplar posts are the ground truth of how they open, pace and phrase; the voice profile is your style guide; never_says is a hard blocklist.

Rules:
- Sound like the exemplars, not like a copywriter. If the exemplars are casual and clipped, the script is casual and clipped.
- Build on the assigned format's structure when one is given.
- Facts and numbers must come from the brief's receipts. Invent nothing.
- Write for speech: short sentences, no headings, no hashtags in the talk-track.`

export type WriterResult = { work_id: string; tokens: number }

export async function draftForUser(
  supabase: SupabaseClient,
  userId: string,
  args: { storyId?: string; brief?: string },
): Promise<WriterResult | null> {
  const [{ data: story }, { data: canon }] = await Promise.all([
    args.storyId
      ? supabase.schema("creator").from("creator_stories")
          .select("id,thesis,angle,why_now,why_you,receipts,suggested_pillar_id,suggested_format_id,canon_version")
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

  const briefBlock = story
    ? `BRIEF (approved story dossier):\nThesis: ${story.thesis}\nAngle: ${story.angle ?? "—"}\nWhy now: ${story.why_now ?? "—"}\nWhy this creator: ${story.why_you ?? "—"}\nReceipts: ${JSON.stringify(story.receipts)}`
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
      body: object.script,
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
      hook: object.hook,
      estimated_duration_seconds: object.estimated_duration_seconds,
    })
    .select("id")
    .single()
  if (error) throw error

  return { work_id: workRow.id, tokens: usage.totalTokens }
}

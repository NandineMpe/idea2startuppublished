import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"

/**
 * Synthesis — turn raw signals into story dossiers.
 *
 * The uniqueness muscle lives here, in two enforced properties:
 *  1. Every story must be a synthesis KIND (connection / contradiction /
 *     second-order / trend break / own-content), never a restated headline.
 *  2. The editor gate: a story citing fewer than two distinct signals stays in
 *     'watchlist' and never reaches the Desk. Enforced in code, not the prompt.
 */

export const SYNTHESIS_PROMPT_VERSION = "creator-synthesise-v1"

const SIGNAL_WINDOW_HOURS = 72
const MAX_SIGNALS_IN_PROMPT = 60
const MAX_STORIES_PER_RUN = 5

const storySchema = z.object({
  thesis: z.string().describe("The unique claim, one or two sentences. Not a headline restated — a take that requires the cited signals together."),
  synthesis_kind: z.enum(["connection", "contradiction", "second_order", "trend_break", "own_content"]),
  signal_indexes: z.array(z.number().int()).describe("Indexes into the numbered signal list that this thesis stands on."),
  receipts: z.array(z.object({
    signal_index: z.number().int(),
    quote: z.string().describe("The specific fact/number/quote from that signal that supports the thesis."),
  })),
  why_now: z.string().describe("Why this week, not next month."),
  why_you: z.string().describe("Why THIS creator's audience cares, referencing their pillars/topics where possible."),
  angle: z.string().describe("A suggested opening angle written in the creator's voice."),
  suggested_pillar_id: z.string().nullable(),
})

const synthesisSchema = z.object({
  stories: z.array(storySchema).max(MAX_STORIES_PER_RUN),
})

type SignalRow = {
  id: string
  source_key: string
  title: string
  url: string | null
  published_at: string | null
  snippet: string | null
  topics: string[]
}

const SYSTEM_PROMPT = `You are the research desk of a one-person creator's management agency. You are an investigative researcher, not an aggregator: your job is to connect dots across signals and produce theses the creator could not get from any single headline.

Rules:
- A thesis must REQUIRE at least two of the provided signals together (or one signal connected to the creator's own published work for kind "own_content"). If a candidate idea rests on a single headline, do not propose it.
- Prefer contradiction (received wisdom vs the data), cross-domain connection, and second-order implications for the creator's specific audience.
- Never repeat or lightly rephrase a thesis from the "recent theses" list.
- Receipts must be concrete: a number, a quote, a named action — not "sources say".
- Write "angle" in the creator's voice profile if one is provided; otherwise plain and direct.
- Fewer, stronger stories beat more, weaker ones. Zero stories is an acceptable output.`

export type SynthesisResult = {
  proposed: number
  watchlisted: number
  skipped_bad_refs: number
  tokens: number
}

export async function synthesiseStoriesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<SynthesisResult> {
  const since = new Date(Date.now() - SIGNAL_WINDOW_HOURS * 3600 * 1000).toISOString()

  const [{ data: signals }, { data: canon }, { data: recentPosts }, { data: recentStories }] = await Promise.all([
    supabase.schema("creator").from("creator_signals")
      .select("id,source_key,title,url,published_at,snippet,topics")
      .eq("user_id", userId)
      .gte("ingested_at", since)
      .order("published_at", { ascending: false })
      .limit(MAX_SIGNALS_IN_PROMPT),
    supabase.schema("creator").from("creator_canon")
      .select("version,pillars,voice,topics")
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.schema("creator").from("creator_content")
      .select("caption,transcript,posted_at,metrics")
      .eq("user_id", userId)
      .order("posted_at", { ascending: false })
      .limit(15),
    supabase.schema("creator").from("creator_stories")
      .select("thesis")
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
      .limit(30),
  ])

  const signalRows = (signals ?? []) as SignalRow[]
  if (signalRows.length < 2) {
    return { proposed: 0, watchlisted: 0, skipped_bad_refs: 0, tokens: 0 }
  }

  const signalList = signalRows
    .map((s, i) => `[${i}] (${s.source_key}, ${s.published_at ?? "undated"}) ${s.title}${s.snippet ? ` — ${s.snippet.slice(0, 280)}` : ""}`)
    .join("\n")

  const canonBlock = canon
    ? `CREATOR CANON (v${canon.version}):\nPillars: ${JSON.stringify(canon.pillars)}\nTopics: ${JSON.stringify(canon.topics)}\nVoice: ${JSON.stringify(canon.voice)}`
    : "CREATOR CANON: not yet derived — use the signals' topics as the creator's declared niche."

  const corpusBlock = (recentPosts ?? []).length
    ? `RECENT PUBLISHED WORK (for own_content connections):\n${(recentPosts ?? [])
        .map((p) => `- ${(p.transcript ?? p.caption ?? "").slice(0, 200)}`)
        .filter((line) => line.length > 2)
        .join("\n")}`
    : "RECENT PUBLISHED WORK: none ingested yet."

  const recentTheses = (recentStories ?? []).map((s) => `- ${s.thesis}`).join("\n") || "- none"

  const { object, usage } = await creatorGenerateObject({
    schema: synthesisSchema,
    system: SYSTEM_PROMPT,
    prompt: `SIGNALS (last ${SIGNAL_WINDOW_HOURS}h, numbered):\n${signalList}\n\n${canonBlock}\n\n${corpusBlock}\n\nRECENT THESES (do not repeat):\n${recentTheses}\n\nProduce at most ${MAX_STORIES_PER_RUN} story dossiers.`,
    maxOutputTokens: 6000,
  })

  const result: SynthesisResult = { proposed: 0, watchlisted: 0, skipped_bad_refs: 0, tokens: usage.totalTokens }

  for (const story of object.stories) {
    const referenced = [...new Set([...story.signal_indexes, ...story.receipts.map((r) => r.signal_index)])]
      .filter((i) => i >= 0 && i < signalRows.length)
    if (!referenced.length) {
      result.skipped_bad_refs++
      continue
    }

    const signalIds = referenced.map((i) => signalRows[i].id)
    const receipts = story.receipts
      .filter((r) => r.signal_index >= 0 && r.signal_index < signalRows.length)
      .map((r) => ({
        signal_id: signalRows[r.signal_index].id,
        url: signalRows[r.signal_index].url,
        title: signalRows[r.signal_index].title,
        quote: r.quote,
      }))

    // The editor gate. own_content stories may stand on one signal + the corpus;
    // everything else needs at least two independent signals or it stays on watch.
    const distinctSignals = new Set(signalIds).size
    const passesGate = story.synthesis_kind === "own_content" ? distinctSignals >= 1 : distinctSignals >= 2
    const state = passesGate ? "proposed" : "watchlist"

    const { data: storyRow, error: storyError } = await supabase
      .schema("creator")
      .from("creator_stories")
      .insert({
        user_id: userId,
        state,
        thesis: story.thesis,
        synthesis_kind: story.synthesis_kind,
        receipts,
        signal_ids: signalIds,
        why_now: story.why_now,
        why_you: story.why_you,
        angle: story.angle,
        canon_version: canon?.version ?? null,
        suggested_pillar_id: story.suggested_pillar_id,
        model_version: CREATOR_MODEL_VERSION,
        prompt_version: SYNTHESIS_PROMPT_VERSION,
      })
      .select("id")
      .single()
    if (storyError) throw storyError

    if (state === "watchlist") {
      result.watchlisted++
      continue
    }

    // Promote to the Desk: an insight awaiting the creator's decision.
    const { data: workRow, error: workError } = await supabase
      .schema("creator")
      .from("creator_work")
      .insert({
        user_id: userId,
        kind: "insight",
        state: "proposed",
        autonomy: "approve",
        title: story.thesis,
        body: `${story.angle}\n\nWhy now: ${story.why_now}`,
        rationale: story.why_you,
        provenance: {
          agent: "researcher",
          canon_version: canon?.version ?? 0,
          source_post_ids: [],
          story_id: storyRow.id,
          signal_ids: signalIds,
        },
        pillar_id: story.suggested_pillar_id,
      })
      .select("id")
      .single()
    if (workError) throw workError

    await supabase
      .schema("creator")
      .from("creator_stories")
      .update({ work_item_id: workRow.id })
      .eq("id", storyRow.id)

    result.proposed++
  }

  return result
}

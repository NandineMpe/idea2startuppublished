import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { loadTrajectory, trajectoryBlock } from "@/lib/creator/load-trajectory"

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
const MAX_STORIES_PER_RUN = 8

/**
 * Per-lane quotas rather than one "newest N" query.
 *
 * Sorting all signals by date and taking the top N silently starves the lanes
 * that make this worth doing: arXiv carries submission dates and books carry
 * publication years, so both sort below this week's news and would never reach
 * the prompt. Quotas guarantee each register is represented, which is the
 * precondition for the cross-lane connections synthesis is asked to prefer.
 */
const LANE_QUOTAS: Record<string, number> = {
  news: 24,
  papers: 16,
  releases: 12,
  books: 10,
  discussion: 10,
}

/** Reserved for signals from the creator's declared territory, across every lane. */
const HORIZON_QUOTA = 20

const storySchema = z.object({
  thesis: z.string().describe("The unique claim, one or two sentences. Not a headline restated — a take that requires the cited signals together."),
  synthesis_kind: z.enum(["connection", "contradiction", "second_order", "trend_break", "own_content"]),
  move: z.enum(["consolidate", "expand", "advance"]).describe(
    "consolidate = deepens ground the creator already owns. expand = moves them into an adjacent topic. advance = builds the position they said they are moving toward.",
  ),
  signal_indexes: z.array(z.number().int()).describe("Indexes into the numbered signal list that this thesis stands on."),
  receipts: z.array(z.object({
    signal_index: z.number().int(),
    quote: z.string().describe("The specific fact/number/quote from that signal that supports the thesis."),
  })),
  why_now: z.string().describe("Why this week, not next month."),
  why_you: z
    .string()
    .describe(
      "Why this is worth THIS creator's time. For a consolidate story, why their audience cares. For expand or advance, what it builds toward the position they are moving to, and what earns them the standing to say it.",
    ),
  angle: z.string().describe("A suggested opening angle written in the creator's voice."),
  suggested_pillar_id: z.string().nullish(),
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
  lane: string
  stance: string
}

const SYSTEM_PROMPT = `You are the research desk of a one-person creator's management agency. You are an investigative researcher, not an aggregator: your job is to connect dots across signals and produce theses the creator could not get from any single headline.

Each signal is tagged with a LANE and a STANCE.

LANE is the register it came from: news (the cycle), papers (preprints and research), releases (what labs and vendors published themselves), books (long-form argument), discussion (practitioners arguing).
- The strongest theses join signals from DIFFERENT lanes. A preprint that contradicts a press release, a book-length argument the news cycle forgot, practitioners reporting something the vendor's own release notes deny — these are things the audience could not have assembled alone.
- Two news items about the same event is the weakest possible connection. Avoid it.

STANCE is where the topic sits relative to this creator: core is ground they already own; adjacent is the stretch beside it; horizon is territory they told you they are moving toward and may have published nothing in yet.
- Set "move" to consolidate for a thesis that deepens core ground, expand for adjacent territory, advance for one that builds the position in their stated trajectory.
- An expand or advance story must say in "why_you" what earns them the standing to say it. Standing can come from adjacent expertise, not only from having covered the exact topic before. Do not refuse a horizon story merely because there is no precedent in the canon: the absence of precedent is the reason the creator declared it.

The failure mode you are being corrected for: this desk keeps handing back deeper cuts of ground the creator has already worked to death. A creator with a strong archive on one subject will get proposed that subject forever, because it is what the evidence supports, and they will stay a commentator on it instead of becoming the authority they said they want to be. A thesis that only restates their existing position is low value to them even when it is well built.

Rules:
- A thesis must REQUIRE at least two of the provided signals together (or one signal connected to the creator's own published work for kind "own_content"). If a candidate idea rests on a single headline, do not propose it.
- Prefer contradiction (received wisdom vs the data), cross-lane connection, and second-order implications for the creator's specific audience.
- Never repeat or lightly rephrase a thesis from the "recent theses" list.
- Receipts must be concrete: a number, a quote, a named finding — not "sources say".
- Write "angle" in the creator's voice profile if one is provided; otherwise plain and direct.
- When a trajectory is declared, at least half the slate must be advance or expand, and the advance stories should be the ones you argue hardest for. A slate of eight consolidate stories is a failed run even if every thesis is sound.
- Balance still matters in the other direction: a slate with nothing the creator can speak to from experience leaves them sounding unmoored. Keep one or two consolidate stories that put their existing authority behind the newer ground.
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

  // One query per lane so each register is guaranteed a place in the prompt.
  const laneQueries = Object.entries(LANE_QUOTAS).map(async ([lane, quota]) => {
    const { data } = await supabase
      .schema("creator")
      .from("creator_signals")
      .select("id,source_key,title,url,published_at,snippet,topics,lane,stance")
      .eq("user_id", userId)
      .eq("lane", lane)
      .gte("ingested_at", since)
      .order("published_at", { ascending: false })
      .limit(quota)
    return (data ?? []) as SignalRow[]
  })

  // Horizon signals get their own guaranteed slice, not just a place in the
  // lane queues. Territory the creator has no corpus in is thin by definition,
  // so a per-lane "newest N" would let this week's noisy core news crowd it out
  // entirely and the sweep's whole point would be lost between retrieval and
  // the prompt.
  const horizonQuery = supabase
    .schema("creator")
    .from("creator_signals")
    .select("id,source_key,title,url,published_at,snippet,topics,lane,stance")
    .eq("user_id", userId)
    .eq("stance", "horizon")
    .gte("ingested_at", since)
    .order("published_at", { ascending: false })
    .limit(HORIZON_QUOTA)

  const [
    laneResults,
    { data: horizonRows },
    trajectory,
    { data: canon },
    { data: recentPosts },
    { data: recentStories },
  ] = await Promise.all([
    Promise.all(laneQueries),
    horizonQuery,
    loadTrajectory(supabase, userId),
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
      // An archived thesis is still on the do-not-repeat list, which is the
      // point of archiving. A deleted one is not.
      .is("deleted_at", null)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
      .limit(30),
  ])

  // Interleave lanes so no single register dominates the head of the list —
  // ordering shapes what the model reaches for first.
  const byLane = laneResults.filter((rows) => rows.length > 0)
  const interleaved: SignalRow[] = []
  for (let i = 0; byLane.some((rows) => i < rows.length); i++) {
    for (const rows of byLane) {
      if (i < rows.length) interleaved.push(rows[i])
    }
  }

  // Horizon signals lead, for the same reason they get their own quota: they are
  // the ones the creator cannot already predict, and position in the list is
  // itself a weighting.
  const horizon = (horizonRows ?? []) as SignalRow[]
  const seen = new Set(horizon.map((s) => s.id))
  const signalRows: SignalRow[] = [...horizon, ...interleaved.filter((s) => !seen.has(s.id))]

  if (signalRows.length < 2) {
    return { proposed: 0, watchlisted: 0, skipped_bad_refs: 0, tokens: 0 }
  }

  const signalList = signalRows
    .map(
      (s, i) =>
        `[${i}] lane=${s.lane} stance=${s.stance} topic=${s.topics?.[0] ?? "—"} (${s.published_at ?? "undated"}) ${s.title}${
          s.snippet ? ` — ${s.snippet.slice(0, 280)}` : ""
        }`,
    )
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
    prompt: `SIGNALS (last ${SIGNAL_WINDOW_HOURS}h, numbered):\n${signalList}\n\n${trajectoryBlock(trajectory)}\n\n${canonBlock}\n\n${corpusBlock}\n\nRECENT THESES (do not repeat):\n${recentTheses}\n\nProduce at most ${MAX_STORIES_PER_RUN} story dossiers.`,
    maxOutputTokens: 8000,
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
        move: story.move,
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

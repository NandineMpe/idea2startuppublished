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
  // Primary. These hold the document itself, and they get the larger share
  // because a desk that wants to be first cannot be reading only coverage.
  papers: 14,
  filings: 10,
  courts: 10,
  regulation: 10,
  standards: 10,
  patents: 8,
  funding: 8,
  code: 8,
  models: 6,
  releases: 10,
  // Secondary. Deliberately capped: news used to be the largest quota here, and
  // a slate assembled mostly from news is a slate every commentator in the
  // niche could have filed that week.
  news: 12,
  books: 6,
  discussion: 6,
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

LANE is the register a signal came from, and the lanes are not equal.

PRIMARY lanes hold the document itself:
- papers: preprints and research, the claim before the coverage
- patents: what was filed, which is R&D intent rather than marketing, published about 18 months after filing and still ahead of any launch
- filings: what a company told investors under legal liability, which is a very different document from its blog
- courts: complaints, dockets and opinions, often years before any landmark ruling, and expert reports are frequently the most detailed public technical documents that exist on how a system actually works
- funding: research grants and private raises, funded now, published in about two years, productised in about four
- regulation: proposed rules and open comment periods, visible long before anything binds, and a comment period is a door with a deadline
- standards: what "compliant" is going to mean, drafted before anyone has to comply and read by almost nobody
- code: what engineers are actually adopting, which happens before a vendor describes it
- models: what actually shipped, where capability is measurable rather than asserted
- releases: what labs published themselves, unmediated by coverage

SECONDARY lanes are someone writing about what already happened: news, books, discussion.

This distinction is the point of the desk. The creator is trying to be a primary producer of information rather than a second-hand reporter, so:
- A thesis built on primary documents outranks a better-written thesis built on news. Reach for the filing, the docket, the patent, the standard.
- Where a primary source and the coverage of it disagree, that gap is itself the story, and it is the single most valuable thing you can find.
- When you cite a primary document, the receipt should quote the document, not the summary of it. That is what lets the creator say "I read the filing" and be telling the truth.
- News is best used to date something or to show what the consensus reading is, so that the primary document can be set against it.
- Two news items about the same event is the weakest possible connection. Avoid it.
- The strongest theses join lanes that rarely meet: a preprint that contradicts a press release, a patent that shows a vendor knew, a comment period nobody in the profession has noticed, a repo that proves the capability exists already.

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

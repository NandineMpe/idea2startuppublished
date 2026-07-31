import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { loadCreatorPosts } from "@/lib/creator/load-corpus"
import { engagementRate, type CreatorPost } from "@/lib/creator/types"

/**
 * The strategist.
 *
 * Every other agent on this desk argues from the corpus, which means every
 * answer is a version of "do more of what worked". This one is pointed the
 * other way: it takes a declared position, measures the distance from where the
 * creator actually stands, and lays out what closes it.
 *
 * Two outputs earn their place over the rest:
 *
 *  - stop_doing. A strategy that only adds is not a strategy. The pass is
 *    explicitly asked to name content that performs well and still does not
 *    build the position, because that is the trade the creator cannot see from
 *    inside their own analytics.
 *
 *  - search_territory. Queries for where the creator is GOING. These feed the
 *    Researcher's sweep under the 'horizon' stance, so the desk starts reading
 *    about territory the corpus has no precedent for. Without this the whole
 *    exercise stays a document, and the daily research keeps circling the
 *    existing pillars.
 */

export const STRATEGY_PROMPT_VERSION = "creator-strategise-v1"

const strategySchema = z.object({
  position_now: z
    .string()
    .describe(
      "An honest read of the position the creator holds TODAY, from their evidence. Not flattering. If they are a commentator rather than an authority, say that.",
    ),
  // Newline-delimited rather than arrays of objects: several string arrays or a
  // nested object in one schema makes this model emit tool-call markup into the
  // JSON and abandon the rest of the response.
  gap_names: z.string().describe("Each gap between the position held and the position declared, ONE PER LINE. Four to six."),
  gap_why: z
    .string()
    .describe("Why each gap matters for THIS declared position, ONE PER LINE, same order as gap_names."),
  gap_closes_with: z
    .string()
    .describe("The concrete thing that closes each gap, ONE PER LINE, same order. An artifact, a room, a body of work, a named relationship. Not 'post more'."),

  phase_names: z.string().describe("Phases of the plan in order, ONE PER LINE. Three or four."),
  phase_months: z.string().describe("The months each phase covers, ONE PER LINE, same order. E.g. 'Months 1-3'."),
  phase_objectives: z
    .string()
    .describe("What is true at the end of each phase, ONE PER LINE, same order. A testable state, not an activity."),
  phase_plays: z
    .string()
    .describe(
      "The plays for each phase, ONE PHASE PER LINE, with the individual plays inside a line separated by ' | '. Same order as phase_names.",
    ),

  proof_needed: z
    .string()
    .describe(
      "What has to EXIST for the claim to be credible to the target audience, ONE PER LINE. Artifacts, citations, named engagements, a body of work on a specific question. Not follower counts.",
    ),
  rooms: z
    .string()
    .describe(
      "Where the target audience actually is, ONE PER LINE, named specifically. Publications, conferences, professional bodies, communities, podcasts. Not 'LinkedIn'.",
    ),
  stop_doing: z
    .string()
    .describe(
      "Content or activity that performs but does not build the declared position, ONE PER LINE. Be willing to name something that does numbers. Two to four.",
    ),
  search_territory: z
    .string()
    .describe(
      "Search queries the research desk should run to cover where the creator is GOING, ONE PER LINE, six to eight. Real searchable phrases a news index or preprint server would match, not themes. These must cover the destination, not the existing content.",
    ),
})

const SYSTEM_PROMPT = `You are the strategist on a one-person creator's management agency. The rest of the desk works from what the creator has already published. You do the opposite: you are given a position they want to hold, and your job is to work backwards from it.

You are given their declared trajectory, their canon derived from published work, and their real performance numbers.

The trap you must avoid: treating the existing content as the plan. A creator who already gets good numbers on a topic will be told forever to do more of it, and that is how someone stays a commentator on a subject instead of becoming the authority on it. Your value is being the one input that argues from the destination.

Rules:
- position_now must be honest and specific. "Respected voice in the space" is worthless. Name what they are actually credited with today, and be willing to say the position is smaller than the ambition.
- Gaps must be things that are MISSING, not things to do more of. Distribution is rarely the gap for someone who already has reach. Standing, proof, relationships, a body of work on one question, and access to the rooms where decisions get made usually are.
- closes_with must be a concrete artifact or event: a named report, a talk at a named conference, a series on one question, a co-authored piece with a named institution. Never "consistent posting".
- The sequence must build. A phase that could run in any order is not a sequence. Each phase should make the next one possible.
- proof_needed is about credibility with the TARGET audience, which is usually a different bar from the audience they have. Professionals credit different things than a general feed does.
- rooms must be named. "Industry conferences" is useless; a named conference, a named professional body, a named publication is useful.
- stop_doing is the hardest and most valuable field. Name content that gets views but does not compound toward the position. If everything they do is on-strategy, say so, but look hard first.
- search_territory decides what the research desk reads every morning from now on. Write queries for the destination. If the creator says they are moving toward how professionals adopt AI, do not hand back queries about the topics already in their canon.
- If what the creator says they are building commercially conflicts with the audience they are optimising for, say so plainly in a gap.
- Never flatter. This document is only useful if it tells them something their own analytics cannot.`

function toLines(value: string, limit = 12): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*–]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .slice(0, limit)
}

function evidenceBlock(posts: CreatorPost[]): string {
  const measured = posts.filter((p) => p.metrics)
  if (!measured.length) return "PERFORMANCE: no metrics captured yet."

  const rates = measured
    .map((p) => ({ post: p, rate: engagementRate(p.metrics) }))
    .filter((r): r is { post: CreatorPost; rate: number } => r.rate !== null)
  const sorted = [...rates].sort((a, b) => b.rate - a.rate)
  const byViews = [...measured].sort((a, b) => (b.metrics?.views ?? 0) - (a.metrics?.views ?? 0))

  const lines = [
    `PERFORMANCE (${measured.length} posts with metrics):`,
    `Total views: ${measured.reduce((a, p) => a + (p.metrics?.views ?? 0), 0).toLocaleString()}`,
    `Total saves: ${measured.reduce((a, p) => a + (p.metrics?.saves ?? 0), 0).toLocaleString()}`,
    "",
    "Highest reach:",
    ...byViews.slice(0, 5).map(
      (p) =>
        `- ${(p.metrics?.views ?? 0).toLocaleString()} views: ${(p.caption ?? p.transcript ?? "").slice(0, 140)}`,
    ),
    "",
    "Highest engagement rate:",
    ...sorted.slice(0, 5).map(
      (r) => `- ${r.rate.toFixed(1)}%: ${(r.post.caption ?? r.post.transcript ?? "").slice(0, 140)}`,
    ),
  ]
  return lines.join("\n")
}

export type StrategyResult =
  | { ok: true; version: number; gaps: number; phases: number; territory: number; tokens: number }
  | { ok: false; error: string }

export async function strategiseTrajectory(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrategyResult> {
  const [{ data: trajectory }, { data: canon }, posts] = await Promise.all([
    supabase
      .schema("creator")
      .from("creator_trajectory")
      .select("*")
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("creator")
      .from("creator_canon")
      .select("version,pillars,formats,topics,voice,positioning,corpus_size,confidence")
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadCreatorPosts(supabase, userId),
  ])

  if (!trajectory) {
    return { ok: false, error: "Say where you are going first. The strategy is derived against it." }
  }

  const declared = [
    `NORTH STAR: ${trajectory.north_star}`,
    trajectory.target_audience ? `TARGET AUDIENCE: ${trajectory.target_audience}` : null,
    trajectory.what_it_serves ? `WHAT THE POSITION SERVES: ${trajectory.what_it_serves}` : null,
    `HORIZON: ${trajectory.horizon_months} months`,
    trajectory.positions_to_claim?.length
      ? `ARGUMENTS THEY WANT TO OWN:\n${trajectory.positions_to_claim.map((p: string) => `- ${p}`).join("\n")}`
      : null,
    trajectory.off_strategy?.length
      ? `EXPLICITLY OFF STRATEGY:\n${trajectory.off_strategy.map((p: string) => `- ${p}`).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n")

  const canonBlock = canon
    ? `CANON (v${canon.version}, ${canon.corpus_size} posts, confidence ${canon.confidence}):\nPillars: ${JSON.stringify(canon.pillars)}\nTopics: ${JSON.stringify(canon.topics)}\nFormats: ${JSON.stringify(canon.formats)}\nVoice: ${JSON.stringify(canon.voice)}`
    : "CANON: not derived yet. Work from the performance evidence alone."

  try {
    const { object, usage } = await creatorGenerateObject({
      schema: strategySchema,
      system: SYSTEM_PROMPT,
      prompt: `WHERE THE CREATOR SAYS THEY ARE GOING:\n${declared}\n\nWHAT THEY HAVE PUBLISHED SO FAR:\n${canonBlock}\n\n${evidenceBlock(posts)}\n\nWork backwards from the declared position. Where are they actually standing, what is missing, in what order does it get built, and what should they stop doing?`,
      maxOutputTokens: 24000,
    })

    const gapNames = toLines(object.gap_names, 6)
    const gapWhy = toLines(object.gap_why, 6)
    const gapCloses = toLines(object.gap_closes_with, 6)
    const gaps = gapNames.map((gap, i) => ({
      gap,
      why_it_matters: gapWhy[i] ?? "",
      closes_with: gapCloses[i] ?? "",
    }))

    const phaseNames = toLines(object.phase_names, 4)
    const phaseMonths = toLines(object.phase_months, 4)
    const phaseObjectives = toLines(object.phase_objectives, 4)
    const phasePlays = toLines(object.phase_plays, 4)
    const sequence = phaseNames.map((phase, i) => ({
      phase,
      months: phaseMonths[i] ?? "",
      objective: phaseObjectives[i] ?? "",
      plays: (phasePlays[i] ?? "")
        .split("|")
        .map((p) => p.trim())
        .filter(Boolean),
    }))

    const searchTerritory = toLines(object.search_territory, 8)

    const { error } = await supabase
      .schema("creator")
      .from("creator_trajectory")
      .update({
        position_now: object.position_now,
        gaps,
        sequence,
        proof_needed: toLines(object.proof_needed, 8),
        rooms: toLines(object.rooms, 10),
        stop_doing: toLines(object.stop_doing, 5),
        search_territory: searchTerritory,
        strategy_derived_at: new Date().toISOString(),
        model_version: CREATOR_MODEL_VERSION,
        prompt_version: STRATEGY_PROMPT_VERSION,
      })
      .eq("id", trajectory.id)
      .eq("user_id", userId)

    if (error) return { ok: false, error: error.message }

    return {
      ok: true,
      version: trajectory.version,
      gaps: gaps.length,
      phases: sequence.length,
      territory: searchTerritory.length,
      tokens: usage.totalTokens,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not derive the strategy." }
  }
}

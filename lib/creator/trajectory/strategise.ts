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
  //
  // Every list that has to line up with another carries an explicit "N:" index
  // rather than relying on position. Positional alignment failed on the first
  // real run: asked for one item per line, the model put six items on one line
  // separated by pipes, and everything after the first row was silently blank.
  // An index that travels with the item cannot drift.
  gap_names: z.string().describe("Each gap between the position held and the position declared, ONE PER LINE, prefixed '1: ', '2: ' and so on. Four to six."),
  gap_why: z
    .string()
    .describe("Why each gap matters, ONE PER LINE, each prefixed with the matching gap number: '1: because...'."),
  gap_closes_with: z
    .string()
    .describe("The concrete thing that closes each gap, ONE PER LINE, each prefixed with the matching gap number: '1: ...'. An artifact, a room, a body of work, a named relationship. Not 'post more'."),

  phase_names: z.string().describe("Phases of the plan in order, ONE PER LINE, prefixed '1: ', '2: '. Three or four."),
  phase_months: z.string().describe("The months each phase covers, ONE PER LINE, prefixed with the matching phase number: '1: Months 1-3'."),
  phase_objectives: z
    .string()
    .describe("What is true at the end of each phase, ONE PER LINE, prefixed with the matching phase number. A testable state, not an activity."),
  phase_plays: z
    .string()
    .describe(
      "Every play, ONE PLAY PER LINE, each prefixed with the number of the phase it belongs to: '1: declare the flagship question'. Several lines may share a phase number. Four to six plays per phase.",
    ),

  proof_needed: z
    .string()
    .describe(
      "What has to EXIST for the claim to be credible to the target audience, ONE PER LINE. Artifacts, citations, named engagements, a body of work on a specific question. Not follower counts.",
    ),
  rooms: z
    .string()
    .describe(
      "Where the target audience actually is, ONE PER LINE, named specifically, and located IN THE DECLARED TARGET MARKETS. Publications, conferences, professional bodies, communities, podcasts. Not 'LinkedIn'.",
    ),
  stop_doing: z
    .string()
    .describe(
      "Content or activity that performs but does not build the declared position, ONE PER LINE. Be willing to name something that does numbers. Two to four.",
    ),
  search_territory: z
    .string()
    .describe(
      "Search queries the research desk should run to cover where the creator is GOING, ONE PER LINE, six to eight. Real searchable phrases a news index or preprint server would match, not themes. These must cover the destination, not the existing content, and they must be scoped to the declared target markets: name those markets' regulators, standard setters and institutions, not the ones the creator's past posts happened to mention.",
    ),
})

const SYSTEM_PROMPT = `You are the strategist on a one-person creator's management agency. The rest of the desk works from what the creator has already published. You do the opposite: you are given a position they want to hold, and your job is to work backwards from it.

You are given their declared trajectory, their canon derived from published work, and their real performance numbers.

The trap you must avoid: treating the existing content as the plan. A creator who already gets good numbers on a topic will be told forever to do more of it, and that is how someone stays a commentator on a subject instead of becoming the authority on it. Your value is being the one input that argues from the destination.

The declaration can tell you HOW the creator intends to win, not only where they are going, and when it does that reasoning outranks your default playbook. If they tell you their edge is technical depth rather than institutional endorsement, do not hand back an accreditation plan. If they tell you the bodies in their field are behind the technology, do not route their standing through those bodies. Read the declaration for strategy, not just for a destination, and say plainly when you think it is wrong rather than quietly planning around it.

Do not assume standing comes from institutions. That is the default answer in mature fields and it is often wrong in fast-moving ones, where the professional bodies are years behind the practitioners and proximity to a body with no position of its own buys nothing. Before naming an institution as a room, ask whether it actually holds a substantive position on this subject. Where it does not, route standing through primary work instead: original technical explanation, being first and demonstrably right, a working artifact, a public track record that can be checked. Being early and correct in public is a credential, and in a field this young it is frequently the stronger one.

Geography is declared, never inferred. The creator's corpus tells you which institutions their posts have mentioned, and that reflects the audience an algorithm has been serving them, not the market they are going after. Those are frequently different, and reading geography off the content is how a plan ends up built on the wrong continent's regulators.

- Every named room, publication, professional body, conference, regulator and stage must sit in the declared target markets, in roughly their priority order. If the creator's existing content is full of one country's institutions and their target markets are elsewhere, that is a finding to state, not a lead to follow.
- Where the creator is based and where they are selling can differ. Being based somewhere is useful for travel cost, timezone and local standing, and it is not a reason to aim the strategy there.
- If the audience they have is in a different market from the audience they need, treat that as a gap of its own with concrete distribution plays: which market's references, regulators, hours, spellings and examples to use, and which to stop using. An algorithm serves more of whoever already engages, so this does not correct itself.
- Where markets differ in what they credit, say so. A regulator that carries weight in one market means nothing in another, and a professional body's letters after your name do not travel.

Rules:
- position_now must be honest and specific. "Respected voice in the space" is worthless. Name what they are actually credited with today, and be willing to say the position is smaller than the ambition.
- Gaps must be things that are MISSING, not things to do more of. Distribution is rarely the gap for someone who already has reach. Standing, proof, relationships, a body of work on one question, and access to the rooms where decisions get made usually are.
- closes_with must be a concrete artifact or event: a named report, a talk at a named conference, a series on one question, a co-authored piece with a named institution. Never "consistent posting".
- The sequence must build. A phase that could run in any order is not a sequence. Each phase should make the next one possible.
- proof_needed is about credibility with the TARGET audience, which is usually a different bar from the audience they have. Proof can be a credential, but it can equally be a demonstration, a working artifact, an original technical explanation nobody else is giving, or a public record of having called something early and correctly. Choose the form of proof that the declared strategy actually calls for.
- rooms must be named, and a room is anywhere the target audience is reachable: a named conference, publication, podcast, practitioner community or platform. Do not fill this with professional bodies by default. "Industry conferences" is useless; a named one is useful.
- stop_doing is the hardest and most valuable field. Name content that gets views but does not compound toward the position. If everything they do is on-strategy, say so, but look hard first.
- search_territory decides what the research desk reads every morning from now on. Write queries for the destination. If the creator says they are moving toward how professionals adopt AI, do not hand back queries about the topics already in their canon.
- If what the creator says they are building commercially conflicts with the audience they are optimising for, say so plainly in a gap.
- Never flatter. This document is only useful if it tells them something their own analytics cannot.`

/**
 * Split a plain list.
 *
 * Newlines are the contract, but the model reliably reaches for " | " when a
 * list is long, so a single line carrying pipes is treated as a list too. A real
 * sentence containing one pipe is not a thing anyone writes.
 */
function toLines(value: string, limit = 12): string[] {
  const raw = value.split(/\r?\n/).filter((l) => l.trim())
  const parts = raw.length <= 1 && value.includes("|") ? value.split("|") : raw
  return parts
    .map((line) => line.replace(/^\s*(?:[-•*–]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .slice(0, limit)
}

/**
 * Split a list whose items carry an explicit "N:" index, and return them grouped
 * by that index. Items with no usable index fall to the end in order, so a
 * partially compliant response degrades rather than silently losing rows.
 */
function toIndexed(value: string, limit = 12): Map<number, string[]> {
  const grouped = new Map<number, string[]>()
  const unindexed: string[] = []

  for (const line of toLines(value, limit * 8)) {
    const match = line.match(/^(\d+)\s*[:.)-]\s*(.+)$/)
    if (match) {
      const idx = Number.parseInt(match[1], 10)
      if (idx >= 1 && idx <= limit) {
        const list = grouped.get(idx) ?? []
        list.push(match[2].trim())
        grouped.set(idx, list)
        continue
      }
    }
    unindexed.push(line)
  }

  for (const orphan of unindexed) {
    for (let i = 1; i <= limit; i++) {
      if (!grouped.has(i)) {
        grouped.set(i, [orphan])
        break
      }
    }
  }

  return grouped
}

/** The first value recorded at each index, in index order, up to `count`. */
function firstAt(grouped: Map<number, string[]>, count: number): string[] {
  return Array.from({ length: count }, (_, i) => grouped.get(i + 1)?.[0] ?? "")
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
    trajectory.based_in ? `BASED IN: ${trajectory.based_in}` : null,
    trajectory.target_markets?.length
      ? `TARGET MARKETS, IN PRIORITY ORDER: ${trajectory.target_markets.join(", ")}`
      : null,
    trajectory.audience_now ? `WHERE THE AUDIENCE ACTUALLY IS TODAY: ${trajectory.audience_now}` : null,
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

    const gapNames = firstAt(toIndexed(object.gap_names, 6), 6).filter(Boolean)
    const gapWhy = firstAt(toIndexed(object.gap_why, 6), gapNames.length)
    const gapCloses = firstAt(toIndexed(object.gap_closes_with, 6), gapNames.length)
    const gaps = gapNames.map((gap, i) => ({
      gap,
      why_it_matters: gapWhy[i] ?? "",
      closes_with: gapCloses[i] ?? "",
    }))

    const phaseNames = firstAt(toIndexed(object.phase_names, 4), 4).filter(Boolean)
    const phaseMonths = firstAt(toIndexed(object.phase_months, 4), phaseNames.length)
    const phaseObjectives = firstAt(toIndexed(object.phase_objectives, 4), phaseNames.length)
    const playsByPhase = toIndexed(object.phase_plays, 4)
    const sequence = phaseNames.map((phase, i) => ({
      phase,
      months: phaseMonths[i] ?? "",
      objective: phaseObjectives[i] ?? "",
      plays: playsByPhase.get(i + 1) ?? [],
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

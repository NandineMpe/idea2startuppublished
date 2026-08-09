import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRow } from "./query"
import type { CreatorTrajectory } from "./types"

const TRAJECTORY_COLUMNS =
  "id,version,north_star,flagship_question,target_audience,what_it_serves,based_in,target_markets,audience_now,horizon_months,positions_to_claim,off_strategy,position_now,gaps,sequence,proof_needed,rooms,stop_doing,search_territory,strategy_derived_at"

export async function loadTrajectory(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreatorTrajectory | null> {
  return safeRow<CreatorTrajectory>(
    supabase
      .schema("creator")
      .from("creator_trajectory")
      .select(TRAJECTORY_COLUMNS)
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
}

/**
 * The trajectory as every agent sees it.
 *
 * One shared block rather than each agent formatting its own, because the
 * failure this whole object exists to fix is agents quietly disagreeing about
 * what the creator is doing. They should be reading the same words.
 *
 * The final instruction is deliberately blunt. Given a canon and a trajectory in
 * the same prompt, a model will reach for the canon every time: it is longer,
 * concrete, and full of evidence, while the trajectory is one sentence about
 * something that has not happened yet. Saying which one wins is the difference
 * between this changing the output and it being decoration.
 */
export function trajectoryBlock(trajectory: CreatorTrajectory | null): string {
  if (!trajectory) {
    return "TRAJECTORY: not declared. Work from the canon, and prefer moves that widen the creator's position rather than repeating it."
  }

  const parts = [
    `WHERE THIS CREATOR IS GOING (declared by them, and it outranks the canon):`,
    `North star: ${trajectory.north_star}`,
    // Stated immediately after the north star and before anything about
    // formats, because the ordering is the instruction. The desk had been
    // ranking candidates against the format list, which is how it kept
    // returning excellent examples of the wrong thing.
    trajectory.flagship_question
      ? `FLAGSHIP QUESTION, the named argument this creator is claiming: "${trajectory.flagship_question}"\nRank everything by how far it moves this question. The named argument outranks the named formats. A perfect instance of a favoured format that does not move this question ranks below a rougher candidate that does.`
      : null,
    trajectory.target_audience ? `Audience they need: ${trajectory.target_audience}` : null,
    trajectory.what_it_serves ? `What the position serves: ${trajectory.what_it_serves}` : null,
    trajectory.based_in ? `Based in: ${trajectory.based_in}` : null,
    // Named before the canon for a reason: a corpus reflects the audience the
    // algorithm has been serving, not the one the creator is going after, so
    // geography inferred from the content is systematically the wrong answer.
    trajectory.target_markets?.length
      ? `Markets they are going after, in priority order: ${trajectory.target_markets.join(", ")}. Institutions, publications, stages and brands must be in these markets. Do not default to the markets their existing content happens to mention.`
      : null,
    trajectory.audience_now ? `Where the audience actually is today: ${trajectory.audience_now}` : null,
    trajectory.positions_to_claim?.length
      ? `Arguments they want to own: ${trajectory.positions_to_claim.join("; ")}`
      : null,
    trajectory.off_strategy?.length ? `Off strategy: ${trajectory.off_strategy.join("; ")}` : null,
    trajectory.position_now ? `Where they actually stand today: ${trajectory.position_now}` : null,
    trajectory.gaps?.length
      ? `Gaps to close: ${trajectory.gaps.map((g) => `${g.gap} (closes with: ${g.closes_with})`).join("; ")}`
      : null,
    trajectory.rooms?.length ? `Rooms the target audience is in: ${trajectory.rooms.join("; ")}` : null,
    trajectory.stop_doing?.length
      ? `Already performing but off trajectory, do not hand more of this back: ${trajectory.stop_doing.join("; ")}`
      : null,
    "",
    "The canon below describes what they have already published. It is evidence of capability, not a brief. Where the two point in different directions, serve the trajectory.",
  ]

  return parts.filter((p) => p !== null).join("\n")
}

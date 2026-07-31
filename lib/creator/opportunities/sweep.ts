import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { loadWorth } from "@/lib/creator/load-worth"
import { loadTrajectory, trajectoryBlock } from "@/lib/creator/load-trajectory"
import { CREATOR_MARKETPLACES } from "./marketplaces"
import { huntApolloCompanies, huntEvents, huntSponsors, type OpportunityCandidate } from "./hunt"

/**
 * Opportunities sweep: hunt → one Claude pass (rank, dedupe, draft the pitch)
 * → Desk work items. Every opportunity ships with the pitch already written,
 * grounded in the creator's real numbers where Worth can stand one up.
 * Autonomy is always `approve` — nothing leaves the creator's name unseen.
 */

export const OPPORTUNITIES_PROMPT_VERSION = "creator-opportunities-v1"

const MAX_OPPORTUNITIES_PER_RUN = 6

const opportunitySchema = z.object({
  kind: z.enum(["deal", "event"]),
  title: z.string().describe("Brand, event or platform name plus the one-line opportunity."),
  why_fit: z.string().describe("Why this creator specifically, referencing their topics/pillars and any evidence."),
  pitch: z.string().describe("The outreach message, ready to send, in the creator's voice. Include the rate range only when one was provided."),
  evidence_urls: z.array(z.string()).describe("URLs backing this opportunity, from the candidate list."),
  candidate_lane: z.enum(["sponsors", "events", "apollo", "marketplace"]),
})

const sweepSchema = z.object({
  opportunities: z.array(opportunitySchema).max(MAX_OPPORTUNITIES_PER_RUN),
})

const SYSTEM_PROMPT = `You are the partnerships desk of a one-person creator's management agency. You turn raw signals about brands, events and platforms into a small number of high-conviction opportunities, each with the pitch already drafted.

An opportunity is worth proposing for one of two reasons, and you should be explicit in why_fit about which:
  1. It pays well for what the creator already does.
  2. It puts them in a room that builds the position they are moving toward, even if it pays little or nothing.

The second kind is the one this desk has been under-supplying. Ranking every opportunity by fit with the existing archive means the creator gets offered more of the audience they already have, and the rooms where their target audience actually is never appear. A modest panel in front of the right professionals can be worth more than a paid post to the wrong crowd, and you should say so plainly when it is true.

Rules:
- Propose only opportunities with a concrete why-fit for THIS creator. Generic "brand X exists" is not an opportunity.
- When a trajectory is declared, weigh opportunities against the position the creator is building and the audience they need, not only against the topics of their published work. Absence of past precedent is not a disqualification.
- If an opportunity is prestigious but off-trajectory, say that in why_fit rather than quietly ranking it first.
- Warm beats cold: a brand already sponsoring creators in this niche outranks a keyword-matched company.
- Respect the declared target markets. A stage or a brand outside them is usually a worse use of the creator's time than a smaller one inside them, because budgets, buyers and professional credibility do not cross borders evenly. If you propose something outside the target markets, justify it explicitly.
- Marketplace listings: propose a platform only if the creator plausibly meets its entry bar and it is not in the already-proposed list.
- Pitches are short (under 150 words), specific, and cite the creator's real numbers when a rate range is provided. Never invent metrics.
- A pitch for a trajectory-building opportunity should lead with the argument the creator wants to be known for, not with their follower count.
- Never repeat anything in the already-proposed list.
- Fewer, stronger opportunities beat volume. Zero is acceptable.`

export type OpportunitySweepResult = {
  candidates: number
  proposed: number
  tokens: number
}

export async function sweepOpportunitiesForUser(
  supabase: SupabaseClient,
  userId: string,
  coreTopics: string[],
  horizonTopics: string[] = [],
): Promise<OpportunitySweepResult> {
  // Sponsors are hunted on proven ground and events on declared ground, because
  // the two answer different questions. A brand buys the audience the creator
  // already has, so pitching it on territory with no published work behind it is
  // a weak pitch. A stage is the opposite: speaking is how the position gets
  // built, and the rooms worth being in are the ones the creator is moving
  // toward rather than the ones their archive already fits.
  const eventTopics = [...horizonTopics, ...coreTopics]
  const dealTopics = [...coreTopics, ...horizonTopics]

  // Markets are needed before the hunt, not just before the ranking, so this
  // one load is awaited ahead of the rest. Ranking by market after searching
  // the wrong one only narrows a list that was wrong to begin with.
  const trajectory = await loadTrajectory(supabase, userId)
  const markets = trajectory?.target_markets ?? []

  const [sponsors, events, apollo, worthContext, { data: existing }, { data: canon }] = await Promise.all([
    huntSponsors(dealTopics, markets),
    huntEvents(eventTopics, markets),
    huntApolloCompanies(dealTopics, markets),
    loadWorth(supabase, userId),
    supabase.schema("creator").from("creator_work")
      .select("title")
      .eq("user_id", userId)
      // Archived opportunities still suppress a repeat; deleted ones do not,
      // because deleting says the item should never have been proposed.
      .is("deleted_at", null)
      .in("kind", ["deal", "event"])
      .gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
      .limit(60),
    supabase.schema("creator").from("creator_canon")
      .select("version,pillars,voice,topics")
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const candidates: OpportunityCandidate[] = [...sponsors, ...events, ...apollo]
  if (!candidates.length && !CREATOR_MARKETPLACES.length) {
    return { candidates: 0, proposed: 0, tokens: 0 }
  }

  const candidateList = candidates
    .map((c, i) => `[${i}] (${c.lane}) ${c.title}${c.url ? ` <${c.url}>` : ""} — ${c.evidence.slice(0, 300)}`)
    .join("\n") || "none found this run"

  const marketplaceList = CREATOR_MARKETPLACES
    .map((m) => `- ${m.name} <${m.url}>: ${m.focus} Entry bar: ${m.entry_bar}`)
    .join("\n")

  const headline = worthContext.worth?.headline
  const worthBlock = headline
    ? `RATE CARD (derived from ${headline.sample_size} posts with metrics): median ${headline.views_median.toLocaleString()} views/post; defensible range ${headline.currency} ${headline.rate_low}–${headline.rate_high} per sponsored post.`
    : "RATE CARD: not yet derivable — draft pitches without specific numbers."

  const canonBlock = canon
    ? `CREATOR CANON (v${canon.version}):\nTopics: ${JSON.stringify(canon.topics)}\nPillars: ${JSON.stringify(canon.pillars)}\nVoice: ${JSON.stringify(canon.voice)}`
    : `CREATOR CANON: not derived yet. Declared topics: ${coreTopics.join(", ")}`

  const alreadyProposed = (existing ?? []).map((row) => `- ${row.title}`).join("\n") || "- none"

  const { object, usage } = await creatorGenerateObject({
    schema: sweepSchema,
    system: SYSTEM_PROMPT,
    prompt: `CANDIDATES:\n${candidateList}\n\nMARKETPLACES THE CREATOR COULD LIST ON:\n${marketplaceList}\n\n${worthBlock}\n\n${trajectoryBlock(trajectory)}\n\n${canonBlock}\n\nALREADY PROPOSED (last 30 days — do not repeat):\n${alreadyProposed}\n\nPropose at most ${MAX_OPPORTUNITIES_PER_RUN} opportunities, each with a ready-to-send pitch.`,
    maxOutputTokens: 6000,
  })

  let proposed = 0
  for (const opp of object.opportunities) {
    const { error } = await supabase
      .schema("creator")
      .from("creator_work")
      .insert({
        user_id: userId,
        kind: opp.kind,
        state: "proposed",
        autonomy: "approve",
        title: opp.title,
        body: opp.pitch,
        rationale: opp.why_fit,
        provenance: {
          agent: "opportunities",
          canon_version: canon?.version ?? 0,
          source_post_ids: headline?.comparable_post_ids ?? [],
          lane: opp.candidate_lane,
          evidence_urls: opp.evidence_urls,
          model_version: CREATOR_MODEL_VERSION,
          prompt_version: OPPORTUNITIES_PROMPT_VERSION,
        },
      })
    if (error) throw error
    proposed++
  }

  return { candidates: candidates.length, proposed, tokens: usage.totalTokens }
}

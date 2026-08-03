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

  // Flat, not a nested object: a bare nested object in this schema makes the
  // model emit tool-call markup into the JSON and abandon the rest.
  organisation: z
    .string()
    .describe("The organisation to approach, named exactly as it calls itself. Not a description, a name."),
  contact_role: z
    .string()
    .describe(
      "The desk or role to reach: 'commissioning editor', 'head of creator partnerships', 'programme committee'. Always answerable even when no individual is named.",
    ),
  contact_name: z
    .string()
    .describe(
      "An individual's name ONLY if it appears in the supplied sources. Empty string otherwise. Never guess, never infer from a company's size or sector.",
    ),
  contact_route: z
    .string()
    .describe(
      "The URL to go through: a contact page, submissions page, speaker form, or the listing itself. Must come from the numbered candidates. Empty string if none was supplied.",
    ),
  next_action: z
    .string()
    .describe(
      "The single thing to do first, today, in one sentence starting with a verb. 'Email the pitch below to the editorial address on their contact page' beats 'reach out'.",
    ),
  contact_confidence: z
    .enum(["named", "role_only", "unknown"])
    .describe(
      "named = an individual is named in the sources. role_only = the right desk is known but no individual. unknown = you cannot tell who handles this from what you were given.",
    ),
})

const sweepSchema = z.object({
  opportunities: z.array(opportunitySchema).max(MAX_OPPORTUNITIES_PER_RUN),
})

const SYSTEM_PROMPT = `You are the partnerships desk of a one-person creator's management agency. You turn raw signals about brands, events and platforms into a small number of high-conviction opportunities, each with the pitch already drafted.

An opportunity is worth proposing for one of two reasons, and you should be explicit in why_fit about which:
  1. It pays well for what the creator already does.
  2. It puts them in a room that builds the position they are moving toward, even if it pays little or nothing.

The second kind is the one this desk has been under-supplying. Ranking every opportunity by fit with the existing archive means the creator gets offered more of the audience they already have, and the rooms where their target audience actually is never appear. A modest panel in front of the right professionals can be worth more than a paid post to the wrong crowd, and you should say so plainly when it is true.

EVERY OPPORTUNITY MUST BE ACTIONABLE. A drafted pitch with nobody to send it to is not an opportunity, it is an observation, and it leaves the creator doing the part an agency exists to have already done. Before proposing anything, answer: who is the organisation, which desk handles this, how do you reach them, and what is the single first thing to do today.

The one thing you must never do is invent a contact. A plausible name at a real company is worse than no name: it wastes the pitch and burns the introduction, and it is the outreach version of a fabricated citation. If no individual is named in the sources, give the role and set contact_confidence to role_only. If you cannot even tell which desk handles it, say unknown and make next_action the specific thing to look up.

Rules:
- Propose only opportunities with a concrete why-fit for THIS creator. Generic "brand X exists" is not an opportunity.
- contact_route must be a URL from the numbered candidates. Do not construct one from a company name, and do not guess at an email address ever.
- next_action starts with a verb and is doable today. "Submit through the speaker form, deadline 12 September" is an action; "consider reaching out" is not.
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
    agent: "opportunities.sweep",
    log: { supabase, userId },
    maxOutputTokens: 6000,
  })

  // Every URL the model was actually shown. A contact route outside this set was
  // constructed rather than found, and sending a pitch into a made-up address is
  // the outreach version of citing a paper that does not exist.
  const offeredUrls = new Set(
    [...candidates.map((c) => c.url), ...CREATOR_MARKETPLACES.map((m) => m.url)].filter(
      (u): u is string => Boolean(u),
    ),
  )

  let proposed = 0
  for (const opp of object.opportunities) {
    const route = offeredUrls.has(opp.contact_route) ? opp.contact_route : ""
    // A name the model produced without a route to corroborate it is the exact
    // shape of an invented contact, so it is demoted rather than shown.
    const named = Boolean(opp.contact_name.trim()) && opp.contact_confidence === "named" && Boolean(route)

    const counterparty = {
      organisation: opp.organisation.trim(),
      contact_role: opp.contact_role.trim(),
      contact_name: named ? opp.contact_name.trim() : "",
      contact_route: route,
      next_action: opp.next_action.trim(),
      confidence: named ? "named" : opp.contact_role.trim() ? "role_only" : "unknown",
    }

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
        counterparty,
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

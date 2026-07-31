import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { loadWorth } from "@/lib/creator/load-worth"
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

Rules:
- Propose only opportunities with a concrete why-fit for THIS creator. Generic "brand X exists" is not an opportunity.
- Warm beats cold: a brand already sponsoring creators in this niche outranks a keyword-matched company.
- Marketplace listings: propose a platform only if the creator plausibly meets its entry bar and it is not in the already-proposed list.
- Pitches are short (under 150 words), specific, and cite the creator's real numbers when a rate range is provided. Never invent metrics.
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
  topics: string[],
): Promise<OpportunitySweepResult> {
  const [sponsors, events, apollo, worthContext, { data: existing }, { data: canon }] = await Promise.all([
    huntSponsors(topics),
    huntEvents(topics),
    huntApolloCompanies(topics),
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
    : `CREATOR CANON: not derived yet. Declared topics: ${topics.join(", ")}`

  const alreadyProposed = (existing ?? []).map((row) => `- ${row.title}`).join("\n") || "- none"

  const { object, usage } = await creatorGenerateObject({
    schema: sweepSchema,
    system: SYSTEM_PROMPT,
    prompt: `CANDIDATES:\n${candidateList}\n\nMARKETPLACES THE CREATOR COULD LIST ON:\n${marketplaceList}\n\n${worthBlock}\n\n${canonBlock}\n\nALREADY PROPOSED (last 30 days — do not repeat):\n${alreadyProposed}\n\nPropose at most ${MAX_OPPORTUNITIES_PER_RUN} opportunities, each with a ready-to-send pitch.`,
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

import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { loadWorth } from "@/lib/creator/load-worth"
import { loadCreatorPosts } from "@/lib/creator/load-corpus"
import { loadTrajectory, trajectoryBlock } from "@/lib/creator/load-trajectory"
import { engagementRate, type CreatorPost } from "@/lib/creator/types"

/**
 * Moves — what the creator should be doing that they are not.
 *
 * Deals and events answer "who will pay me for what I already do". This asks
 * the harder question: given this audience and these numbers, what is being
 * left on the table. Those answers are argued from the creator's own evidence,
 * not found by searching, which is why this is a generation rather than a hunt.
 *
 * Each move ships with an outline and a script, because "start a newsletter" is
 * advice and a first email with a subject line is a thing you can do today.
 */

export const MOVES_PROMPT_VERSION = "creator-moves-v1"

const moveSchema = z.object({
  title: z.string().describe("The move, named concretely. Not 'diversify revenue' but 'Paid weekly brief for compliance teams'."),
  category: z
    .string()
    .describe("One of: owned audience, paid product, services, media, licensing, partnership, platform."),
  why_you: z
    .string()
    .describe("The evidence from THIS creator's data that makes this move available to them and not to a generic creator. Cite the figure."),
  why_now: z.string().describe("What makes this the right moment rather than someday."),
  realistic_upside: z
    .string()
    .describe("An honest range or order of magnitude, with the assumption stated. Never a promise."),
  effort: z.enum(["low", "medium", "high"]).describe("Honest cost in the creator's time to reach a first result."),
  first_step: z.string().describe("The single next action, doable this week."),
  // Newline-delimited: several string arrays in one schema make this model emit
  // tool-call markup into the JSON and abandon the rest of the object.
  outline: z
    .string()
    .describe("The plan, ONE STEP PER LINE, 4-7 steps, in order. Concrete actions, not phases."),
  script: z
    .string()
    .describe(
      "The thing to actually send or say for the first step — an email, a pitch, a DM, or an opening for a call. Ready to use, no placeholder brackets except a name.",
    ),
  risks: z.string().describe("What would make this a mistake for this creator specifically, ONE PER LINE."),
})

const movesSchema = z.object({
  moves: z.array(moveSchema).describe("4-6 moves, ordered by a blend of upside and how ready this creator is for it."),
})

const SYSTEM_PROMPT = `You advise a creator on what they should be building that they are not building yet. You are not looking for their next sponsored post — you are looking at an audience, a body of work, and a stated destination, and asking what is being left on the table.

When a trajectory is declared, it is the brief. The numbers tell you what this creator can pull off; the trajectory tells you what it should be aimed at. A move that monetises the current audience well but leaves them in the same position in a year is a weaker answer than one that builds the position, even at lower immediate revenue. Say which of the two a move is.

Think across every register a creator can monetise or compound:
- owned audience (newsletter, community, mailing list) — worth most when saves and comments are high, because that audience already treats the work as reference
- paid product (course, template, cohort, paid tier)
- services (consulting, advisory, training, workshops) — often the highest rate per hour when the audience is professional rather than consumer
- media (podcast of their own, column, syndication to trade press, book)
- licensing (corporate training use, republishing rights, curriculum)
- partnership (co-created series, ambassador roles, retained media partner rather than one-off posts)
- platform (a second channel where this audience already exists — LinkedIn, YouTube long-form, Substack)

Rules:
- Every move must be justified with a figure from THIS creator's data. "You have an engaged audience" is not a justification; "31,817 saves across 33 posts means the audience is filing this as reference, which is what a paid brief sells" is.
- A figure justifies that the creator CAN do a move. It does not justify that they SHOULD. Where a trajectory is declared, why_you must also say what the move builds toward the stated position, and at least half the moves should serve it directly.
- If the creator is building a company or product that needs a particular audience, treat reaching that audience as an objective in its own right, not a side effect. Moves that put the right people on an owned list are worth more than moves that add reach.
- Prefer moves the audience composition makes unusually available. A professional audience unlocks advisory and training that a consumer audience does not.
- Be honest about effort and upside. A range with the assumption stated beats a number. Never promise income.
- The script must be usable as written — a real subject line and body, not a template with blanks.
- risks must be specific to this creator, including where a move would conflict with their stated standards.
- Do not propose anything requiring brand partnerships they do not have.
- Order by a blend of upside and readiness; put the one they could start this week first.`

function evidenceBlock(posts: CreatorPost[]): string {
  const measured = posts.filter((p) => p.metrics)
  if (!measured.length) return "No metrics captured yet."

  const rates = measured.map((p) => engagementRate(p.metrics)).filter((r): r is number => r !== null)
  const sortedRates = [...rates].sort((a, b) => a - b)
  const medianEngagement = sortedRates.length ? sortedRates[Math.floor(sortedRates.length / 2)] : null
  const totalViews = measured.reduce((a, p) => a + (p.metrics?.views ?? 0), 0)
  const totalSaves = measured.reduce((a, p) => a + (p.metrics?.saves ?? 0), 0)
  const totalComments = measured.reduce((a, p) => a + (p.metrics?.comments ?? 0), 0)
  const saveRate = totalViews > 0 ? (totalSaves / totalViews) * 100 : null

  return [
    `Posts measured: ${measured.length}`,
    `Total views: ${totalViews.toLocaleString()}`,
    `Total saves (bookmarks): ${totalSaves.toLocaleString()}`,
    saveRate !== null ? `Save rate: ${saveRate.toFixed(2)}% of views` : null,
    `Total comments: ${totalComments.toLocaleString()}`,
    medianEngagement !== null ? `Median engagement: ${medianEngagement.toFixed(1)}% (TikTok norm is around 5%)` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

function toLines(value: string, limit: number): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*–]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .slice(0, limit)
}

export type MovesResult = { ok: true; proposed: number; tokens: number } | { ok: false; error: string }

export async function suggestMovesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<MovesResult> {
  const { data: canon } = await supabase
    .schema("creator")
    .from("creator_canon")
    .select("version,pillars,formats,topics,voice,positioning,corpus_size,confidence")
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!canon) {
    return { ok: false, error: "Derive your canon first — moves are argued from it." }
  }

  const [posts, worthContext, trajectory, { data: existing }] = await Promise.all([
    loadCreatorPosts(supabase, userId),
    loadWorth(supabase, userId),
    loadTrajectory(supabase, userId),
    supabase
      .schema("creator")
      .from("creator_work")
      .select("title")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("kind", "move")
      .gte("created_at", new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString())
      .limit(30),
  ])

  const headline = worthContext.worth?.headline
  const rateLine = headline
    ? `Current sponsored-post band: ${headline.currency} ${headline.rate_low.toLocaleString()}-${headline.rate_high.toLocaleString()}.`
    : "Sponsored-post rate not yet derivable."

  const already = (existing ?? []).map((r) => `- ${r.title}`).join("\n") || "- none"

  try {
    const { object, usage } = await creatorGenerateObject({
      schema: movesSchema,
      system: SYSTEM_PROMPT,
      prompt: `${trajectoryBlock(trajectory)}

CANON v${canon.version} (${canon.corpus_size} posts, confidence ${canon.confidence})

POSITIONING (audience and brand-facing read):
${JSON.stringify(canon.positioning ?? "not written yet")}

PILLARS: ${JSON.stringify(canon.pillars)}
FORMATS: ${JSON.stringify(canon.formats)}
TOPICS: ${JSON.stringify(canon.topics)}
STANDARDS (what they refuse — a move that breaks these is a bad move):
${JSON.stringify(canon.voice)}

EVIDENCE:
${evidenceBlock(posts)}

${rateLine}

ALREADY PROPOSED IN THE LAST 60 DAYS — do not repeat:
${already}

What should this creator be building that they are not, to hold the position they said they are moving toward?`,
      agent: "opportunities.moves",
      log: { supabase, userId },
      maxOutputTokens: 32000,
    })

    let proposed = 0
    for (const move of object.moves.slice(0, 6)) {
      const { error } = await supabase
        .schema("creator")
        .from("creator_work")
        .insert({
          user_id: userId,
          kind: "move",
          state: "proposed",
          autonomy: "approve",
          title: move.title,
          body: move.script,
          rationale: move.why_you,
          outline: {
            category: move.category,
            why_now: move.why_now,
            realistic_upside: move.realistic_upside,
            effort: move.effort,
            first_step: move.first_step,
            steps: toLines(move.outline, 7),
            risks: toLines(move.risks, 4),
          },
          script: move.script,
          provenance: {
            agent: "strategist",
            canon_version: canon.version,
            source_post_ids: headline?.comparable_post_ids ?? [],
            model_version: CREATOR_MODEL_VERSION,
            prompt_version: MOVES_PROMPT_VERSION,
          },
        })
      if (error) return { ok: false, error: error.message }
      proposed++
    }

    return { ok: true, proposed, tokens: usage.totalTokens }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not suggest moves." }
  }
}

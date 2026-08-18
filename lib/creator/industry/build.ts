import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { creatorGenerateObject } from "@/lib/creator/ai/claude"
import { loadTrajectory } from "@/lib/creator/load-trajectory"
import { withoutDashes } from "@/lib/creator/no-dashes"
import { INDUSTRY_SEED_BY_SLUG } from "./definitions"
import { countByBand, evidenceBlock, selectIndustrySignals, type SelectedSignal } from "./select"

/**
 * Build one industry dossier from the corpus.
 *
 * The output is an arc rather than a summary. A summary of a thousand signals is
 * a longer list; an arc has a first point, a present, and a future the evidence
 * actually supports, and only the third of those is worth anyone's attention.
 *
 * The discipline that makes it defensible: the model may only date the future
 * from the lead time of the register it is citing. "Patents filed this year, so
 * this is a 2028 problem" is an argument. "Experts predict" is not, and it is
 * banned outright.
 */

export const INDUSTRY_PROMPT_VERSION = "creator-industry-v1"

/**
 * Flat newline-delimited strings, not arrays of objects.
 *
 * The failure this avoids is specific and total: give this schema an array of
 * `{claim, evidence}` and the model emits its own tool-call parameter markup
 * into the JSON, then abandons every field after it, so the dossier never
 * arrives at all. Each line is parsed back into structure in code, which costs
 * nothing and cannot fail the generation.
 */
const industrySchema = z.object({
  headline: z
    .string()
    .describe(
      "The state of this industry in one sentence a practitioner would recognise as true and would not have written themselves.",
    ),
  arc: z
    .string()
    .describe(
      "The arc, one line each, oldest first, in the form: ERA | PERIOD | CLAIM | evidence indices comma separated. ERA is exactly one of before, shift, now, ahead. PERIOD is a year or a year range. Six to ten lines. Every line except 'before' must cite at least one index.",
    ),
  indicators: z
    .string()
    .describe(
      "One line per register that carries real signal, in the form: LANE | READING | evidence indices. READING is what this register specifically says about this industry's next two years. Only include lanes that appear in the evidence.",
    ),
  open_questions: z
    .string()
    .describe(
      "One question per line. Each must be answerable by evidence that could exist and does not yet, and must be a question this creator is positioned to pursue. No rhetorical questions.",
    ),
})

export type IndustryEvidence = {
  title: string
  url: string | null
  lane: string
  published_at: string | null
}

export type IndustryArcPoint = {
  era: "before" | "shift" | "now" | "ahead"
  period: string
  claim: string
  evidence: IndustryEvidence[]
}

export type IndustryIndicator = {
  lane: string
  reading: string
  evidence: IndustryEvidence[]
}

export type IndustryShift = { claim: string; evidence: IndustryEvidence[] }

const ERAS = new Set(["before", "shift", "now", "ahead"])

/** Resolve model-supplied indices back to real signals, dropping anything out of range. */
function resolve(indices: string, signals: SelectedSignal[]): IndustryEvidence[] {
  return indices
    .split(/[,\s]+/)
    .map((raw) => Number.parseInt(raw.replace(/[^\d]/g, ""), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < signals.length)
    .slice(0, 4)
    .map((n) => {
      const s = signals[n]
      return { title: s.title, url: s.url, lane: s.lane, published_at: s.published_at }
    })
}

function parseArc(raw: string, signals: SelectedSignal[]): IndustryArcPoint[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [eraRaw = "", period = "", claim = "", indices = ""] = line.split("|").map((p) => p.trim())
      const era = eraRaw.toLowerCase()
      if (!ERAS.has(era) || !claim) return null
      return {
        era: era as IndustryArcPoint["era"],
        period,
        claim: withoutDashes(claim),
        evidence: resolve(indices, signals),
      }
    })
    .filter((p): p is IndustryArcPoint => p !== null)
}

function parseIndicators(raw: string, signals: SelectedSignal[]): IndustryIndicator[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [lane = "", reading = "", indices = ""] = line.split("|").map((p) => p.trim())
      if (!lane || !reading) return null
      return { lane: lane.toLowerCase(), reading: withoutDashes(reading), evidence: resolve(indices, signals) }
    })
    .filter((i): i is IndustryIndicator => i !== null)
}

const SYSTEM_PROMPT = `You build an industry dossier for a creator whose entire position is that she reads the registers rather than the coverage.

You are given signals from research lanes, each tagged with how far ahead of visible change that register sits. Patents run 18 to 36 months ahead. Job postings 6 to 12. Consultations 12 to 24. Inspections and court rulings are behind: they report what already broke.

That tagging is the point. Your job is to turn a pile of signals into an arc with a future end, and to date that future from the lead time of the register you are citing.

Rules:
- Every claim after the baseline cites at least one evidence index. A claim you cannot index does not go in.
- Date the future from lead times, never from opinion. "These patents were filed in 2026 and patents run two to three years ahead of product, so this is a 2028 and 2029 problem" is the permitted form. "Experts predict", "industry observers expect", "it is widely believed" and "by 2030 AI will" are banned outright.
- Be specific about practice, not about technology. The reader is a practitioner. "Audit evidence will be machine generated" is a slogan. "The reviewer signing the file will not be able to walk a sample back to a human procedure" is a claim about their Tuesday.
- Say what is NOT supported. If the leading registers are thin, the 'ahead' lines must be fewer and more hedged. Never pad the future to make the arc symmetrical.
- Never invent an actor, a date, a number, a case or a filing. Everything comes from the evidence given.
- Never use an em dash or an en dash. Use a full stop, a comma or a colon.
- No hype and no doom. This is a briefing for someone who works in the industry and will notice immediately if you are performing.

The test: would a ten-year practitioner in this industry read the 'ahead' section and think "I had not connected those, and I can check every one of them".`

export type IndustryBuildResult =
  | {
      ok: true
      headline: string
      arc: IndustryArcPoint[]
      indicators: IndustryIndicator[]
      shifts: IndustryShift[]
      open_questions: string[]
      built_from: Record<string, number>
      tokens: number
    }
  | { ok: false; error: string }

export async function buildIndustryDossier(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
): Promise<IndustryBuildResult> {
  const { data: row } = await supabase
    .schema("creator")
    .from("creator_industries")
    .select("slug,label,audience,baseline,match_terms,arc")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle()

  const seed = INDUSTRY_SEED_BY_SLUG.get(slug)
  const definition = row ?? seed
  if (!definition) return { ok: false, error: `No industry called ${slug}.` }

  const matchTerms: string[] = (row?.match_terms?.length ? row.match_terms : seed?.match_terms) ?? []
  const signals = await selectIndustrySignals(supabase, userId, matchTerms)

  // A dossier built on a handful of signals is a guess with citations. Refused
  // rather than produced, because the failure would be invisible on screen.
  if (signals.length < 8) {
    return {
      ok: false,
      error: `Only ${signals.length} signals in the corpus match this industry. Widen the match terms or let the research sweep run a few more days before building.`,
    }
  }

  const counts = countByBand(signals)
  const trajectory = await loadTrajectory(supabase, userId)

  // The previous arc, so a rebuild can say what moved rather than silently
  // replacing one reading with another. The delta is the content.
  const previous: IndustryArcPoint[] = Array.isArray(row?.arc) ? (row.arc as IndustryArcPoint[]) : []
  const previousBlock = previous.length
    ? `THE PREVIOUS READING (say what has moved since, in the shifts you surface):\n${previous
        .map((p) => `- [${p.era}] ${p.period}: ${p.claim}`)
        .join("\n")}`
    : "THE PREVIOUS READING: none, this is the first build."

  try {
    const { object, usage } = await creatorGenerateObject({
      schema: industrySchema,
      system: SYSTEM_PROMPT,
      prompt: `INDUSTRY: ${definition.label}
WHO THIS IS FOR: ${definition.audience ?? "practitioners in this industry"}

THE BASELINE, before any of this:
${definition.baseline ?? "Not recorded. Infer it from the evidence and mark it clearly as inference."}

${
  trajectory?.flagship_question
    ? `THE CREATOR'S FLAGSHIP QUESTION (the arc should bear on it where the evidence honestly allows, and must not be bent to fit it):\n${trajectory.flagship_question}`
    : ""
}

EVIDENCE, indexed. Cite by index.
Counts: ${counts.ahead} leading, ${counts.present} present, ${counts.behind} lagging.

${evidenceBlock(signals)}

${previousBlock}

Build the dossier.`,
      agent: "industry.build",
      log: { supabase, userId },
      maxOutputTokens: 12000,
    })

    const arc = parseArc(object.arc, signals)
    if (!arc.length) return { ok: false, error: "The build returned no usable arc lines." }

    // The delta is derived here rather than asked for as a fourth field: a model
    // asked to both write an arc and diff it against the old one tends to do
    // neither well, and this comparison is cheap and exact.
    const previousClaims = new Set(previous.map((p) => p.claim.toLowerCase().slice(0, 80)))
    const shifts: IndustryShift[] = previous.length
      ? arc
          .filter((p) => !previousClaims.has(p.claim.toLowerCase().slice(0, 80)))
          .slice(0, 6)
          .map((p) => ({ claim: p.claim, evidence: p.evidence }))
      : []

    return {
      ok: true,
      headline: withoutDashes(object.headline),
      arc,
      indicators: parseIndicators(object.indicators, signals),
      shifts,
      open_questions: object.open_questions
        .split(/\r?\n/)
        .map((q) => withoutDashes(q.replace(/^[-*\d.\s]+/, "").trim()))
        .filter(Boolean)
        .slice(0, 8),
      built_from: { ...counts, total: signals.length, lanes: new Set(signals.map((s) => s.lane)).size },
      tokens: usage.totalTokens,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not build the dossier." }
  }
}

/** Build and persist, seeding the row from the definition on first run. */
export async function refreshIndustry(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
): Promise<{ ok: true; tokens: number } | { ok: false; error: string }> {
  const seed = INDUSTRY_SEED_BY_SLUG.get(slug)
  if (seed) {
    // Seeded on demand rather than by the migration: a migration reapplies every
    // run, so seeding there would overwrite her edited match terms every deploy.
    await supabase
      .schema("creator")
      .from("creator_industries")
      .upsert(
        {
          user_id: userId,
          slug: seed.slug,
          label: seed.label,
          audience: seed.audience,
          baseline: seed.baseline,
          match_terms: seed.match_terms,
        },
        { onConflict: "user_id,slug", ignoreDuplicates: true },
      )
  }

  const result = await buildIndustryDossier(supabase, userId, slug)
  if (!result.ok) return result

  const { error } = await supabase
    .schema("creator")
    .from("creator_industries")
    .update({
      headline: result.headline,
      arc: result.arc,
      indicators: result.indicators,
      shifts: result.shifts,
      open_questions: result.open_questions,
      built_from: result.built_from,
      built_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("slug", slug)

  if (error) return { ok: false, error: error.message }
  return { ok: true, tokens: result.tokens }
}

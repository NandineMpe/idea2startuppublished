import { careerHealthNarrativeSchema, type CareerHealthNarrative } from "./narrative-schema"
import type { CareerHealthStructuredInputs } from "./types"
import { compositeFromPillars } from "./composite-score"

const EM_DASH = /\u2014/

/** Subset of product banned vocabulary for automated gate (see `lib/copy-writing-rules.ts`). */
const BANNED_SUBSTRINGS = [
  "delve",
  "crucial",
  "robust",
  "comprehensive",
  "nuanced",
  "multifaceted",
  "furthermore",
  "moreover",
  "additionally",
  "pivotal",
  "landscape",
  "tapestry",
  "underscore",
  "foster",
  "showcase",
  "intricate",
  "vibrant",
  "fundamental",
  "significant",
  "interplay",
  "here's the kicker",
  "here's the thing",
  "plot twist",
  "let me break this down",
  "the bottom line",
  "make no mistake",
  "can't stress this enough",
] as const

function lowerFields(n: CareerHealthNarrative): string[] {
  return [
    n.headline,
    n.subhead ?? "",
    n.opening,
    n.closing,
    ...n.recommended_actions.flatMap((a) => [a.title, a.detail]),
  ].map((s) => s.toLowerCase())
}

export function validateStructuredInputs(s: CareerHealthStructuredInputs): string[] {
  const errors: string[] = []
  if (!s.period_label?.trim()) errors.push("period_label is empty")
  if (s.report_year < 2000 || s.report_year > 2100) errors.push("report_year out of range")
  if (s.report_quarter < 1 || s.report_quarter > 4) errors.push("report_quarter must be 1-4")
  if (!Array.isArray(s.pillar_scores) || s.pillar_scores.length !== 6) {
    errors.push(`expected 6 pillar_scores, got ${s.pillar_scores?.length ?? 0}`)
  }
  for (const p of s.pillar_scores ?? []) {
    if (p.score_0_100 < 0 || p.score_0_100 > 100) {
      errors.push(`pillar ${p.key} score ${p.score_0_100} out of 0-100`)
    }
    if (!p.summary?.trim()) errors.push(`pillar ${p.key} missing summary`)
  }
  const expected = compositeFromPillars(s.pillar_scores)
  if (Math.abs(expected - s.composite_score_0_100) > 1.01) {
    errors.push(
      `composite_score_0_100 ${s.composite_score_0_100} != mean of pillars ${expected} (tolerance 1)`,
    )
  }
  return errors
}

export function validateNarrativeQuality(n: CareerHealthNarrative): string[] {
  const errors: string[] = []
  const parsed = careerHealthNarrativeSchema.safeParse(n)
  if (!parsed.success) {
    errors.push(`narrative schema: ${parsed.error.message}`)
    return errors
  }

  const rawBundle = [
    parsed.data.headline,
    parsed.data.subhead ?? "",
    parsed.data.opening,
    parsed.data.closing,
    ...parsed.data.recommended_actions.flatMap((a) => [a.title, a.detail]),
  ]
  for (const t of rawBundle) {
    if (EM_DASH.test(t)) {
      errors.push("narrative contains em dash (use comma or period instead)")
      break
    }
  }
  const texts = lowerFields(parsed.data)
  for (const banned of BANNED_SUBSTRINGS) {
    for (const t of texts) {
      if (t.includes(banned)) {
        errors.push(`narrative contains banned phrase or word: "${banned}"`)
        return errors
      }
    }
  }

  const priorities = parsed.data.recommended_actions.map((a) => a.priority)
  if (new Set(priorities).size !== priorities.length) {
    errors.push("recommended_actions priorities must be unique")
  }

  return errors
}

export function validateCompositeMentionedInHeadline(
  composite: number,
  headline: string,
): string[] {
  const rounded = Math.round(composite)
  const alt = String(rounded)
  if (headline.includes(alt)) return []
  if (headline.includes(String(composite))) return []
  return [`headline should include composite score (${rounded}) for shareable artefact consistency`]
}

/** Full gate: structured + narrative. Headline score check is a warning appended only if strict. */
export function validateCareerHealthReportBundle(
  structured: CareerHealthStructuredInputs,
  narrative: CareerHealthNarrative,
  options?: { strictHeadlineScore?: boolean },
): { ok: boolean; errors: string[] } {
  const errors = [...validateStructuredInputs(structured), ...validateNarrativeQuality(narrative)]
  if (options?.strictHeadlineScore) {
    errors.push(
      ...validateCompositeMentionedInHeadline(structured.composite_score_0_100, narrative.headline),
    )
  }
  return { ok: errors.length === 0, errors }
}

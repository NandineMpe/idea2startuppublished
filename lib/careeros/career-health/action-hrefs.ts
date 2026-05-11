import {
  careerHealthNarrativeSchema,
  careerHealthPillarKeyZ,
  type CareerHealthNarrative,
  CAREEROS_ACTION_HREFS,
} from "./narrative-schema"
import type { CareerHealthPillarKey } from "./types"

const ALLOWED = new Set<string>(CAREEROS_ACTION_HREFS)

const PILLAR_DEFAULT_HREF: Record<CareerHealthPillarKey, (typeof CAREEROS_ACTION_HREFS)[number]> = {
  ai_exposure_for_role: "/careeros/skills",
  skill_currency: "/careeros/skills",
  market_demand: "/careeros/market",
  compensation_positioning: "/careeros/market",
  layoff_risk: "/careeros",
  career_velocity: "/careeros/feed",
}

type ActionWithOptionalHref = Omit<CareerHealthNarrative["recommended_actions"][number], "career_os_href"> & {
  career_os_href?: string
}

/** Ensures each action has an allowed href (fixes missing or invalid paths). */
export function normalizeCareerHealthNarrativeHrefs(
  narrative: Omit<CareerHealthNarrative, "recommended_actions"> & {
    recommended_actions: ActionWithOptionalHref[]
  },
): CareerHealthNarrative {
  const fixed: CareerHealthNarrative = {
    ...narrative,
    recommended_actions: narrative.recommended_actions.map((a) => {
      const href = (a.career_os_href ?? "").trim()
      const safe = ALLOWED.has(href)
        ? (href as (typeof CAREEROS_ACTION_HREFS)[number])
        : PILLAR_DEFAULT_HREF[a.related_pillar]
      return {
        title: a.title,
        detail: a.detail,
        related_pillar: a.related_pillar,
        priority: a.priority,
        career_os_href: safe,
      }
    }),
  }
  return careerHealthNarrativeSchema.parse(fixed)
}

export function careerOsActionHrefListForPrompt(): string {
  return CAREEROS_ACTION_HREFS.join(", ")
}

/** For UI and stored rows that may predate `career_os_href`. */
export function resolveRecommendedActionHref(
  relatedPillar: string,
  careerOsHref?: string | null,
): (typeof CAREEROS_ACTION_HREFS)[number] {
  const href = (careerOsHref ?? "").trim()
  if (ALLOWED.has(href)) {
    return href as (typeof CAREEROS_ACTION_HREFS)[number]
  }
  const parsed = careerHealthPillarKeyZ.safeParse(relatedPillar)
  if (parsed.success) {
    return PILLAR_DEFAULT_HREF[parsed.data]
  }
  return "/careeros"
}

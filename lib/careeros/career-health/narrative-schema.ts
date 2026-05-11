import { z } from "zod"

export const CAREEROS_ACTION_HREFS = [
  "/careeros",
  "/careeros/skills",
  "/careeros/market",
  "/careeros/feed",
  "/careeros/onboarding",
  "/careeros/health-report",
] as const

export type CareerOsActionHref = (typeof CAREEROS_ACTION_HREFS)[number]

export const careerOsActionHrefZ = z.enum(CAREEROS_ACTION_HREFS)

export const careerHealthPillarKeyZ = z.enum([
  "ai_exposure_for_role",
  "skill_currency",
  "market_demand",
  "compensation_positioning",
  "layoff_risk",
  "career_velocity",
])

export const careerHealthNarrativeSchema = z.object({
  headline: z.string().max(180),
  subhead: z.string().max(220).optional(),
  opening: z.string().max(1400),
  closing: z.string().max(900),
  recommended_actions: z
    .array(
      z.object({
        title: z.string().max(100),
        detail: z.string().max(500),
        related_pillar: careerHealthPillarKeyZ,
        priority: z.number().int().min(1).max(5),
        /** Deep link into CareerOS (same-origin path only). */
        career_os_href: careerOsActionHrefZ,
      }),
    )
    .min(3)
    .max(5),
})

export type CareerHealthNarrative = z.infer<typeof careerHealthNarrativeSchema>

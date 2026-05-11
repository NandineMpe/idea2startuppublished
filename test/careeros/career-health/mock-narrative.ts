import type { CareerHealthNarrative } from "@/lib/careeros/career-health/narrative-schema"
import type { CareerHealthStructuredInputs } from "@/lib/careeros/career-health/types"

/**
 * Deterministic narrative for automated QA (not shown to end users).
 * Headline includes rounded composite for `validateCompositeMentionedInHeadline`.
 */
export function mockNarrativeForVerify(
  s: CareerHealthStructuredInputs,
  personaId: string,
): CareerHealthNarrative {
  const c = Math.round(s.composite_score_0_100)
  const role = s.profile.current_role_title ?? "your role"
  const hook =
    personaId === "non-tech-marketing"
      ? "Marketing-heavy profile with a smaller hard-tech stack."
      : personaId === "recent-grad-pm"
        ? "Early-career PM track with fewer mapped years."
        : "Mixed signals across skills, pay, and posting trend."

  return {
    headline: `Your Career Health score is ${c} this window (${role}).`,
    subhead: `${hook} Fixture QA copy only.`,
    opening: `We stress-tested ${s.skills.length} tracked skills for persona "${personaId}" plus demand and salary blocks when present. This is a gate check, not live model output.`,
    closing: "Pick one action this week, then refresh caches before the next quarterly scan.",
    recommended_actions: [
      {
        title: "Audit skill exposure mix",
        detail: "Sort skills by exposure score and half-life status.",
        related_pillar: "ai_exposure_for_role",
        priority: 1,
        career_os_href: "/careeros/skills",
      },
      {
        title: "Check posting trend",
        detail: "Open Market demand and read M360 delta for your SOC.",
        related_pillar: "market_demand",
        priority: 2,
        career_os_href: "/careeros/market",
      },
      {
        title: "Calibrate salary input",
        detail: "If pay is blank, add current salary so comp positioning is not neutral.",
        related_pillar: "compensation_positioning",
        priority: 3,
        career_os_href: "/careeros/market",
      },
      {
        title: "Stabilise one at-risk skill",
        detail: "Pick one declining label and add proof via project or course.",
        related_pillar: "skill_currency",
        priority: 4,
        career_os_href: "/careeros/skills",
      },
    ],
  }
}

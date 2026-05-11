import { appendWritingRules } from "@/lib/copy-writing-rules"
import { careerOsActionHrefListForPrompt } from "@/lib/careeros/career-health/action-hrefs"

export const CAREER_HEALTH_PROMPT_VERSION = "career-health-report-v1.2"

export const CAREER_HEALTH_SYSTEM_PROMPT = `You write Career Health Reports for CareerOS users.

Grounding and output shape:
- You receive structured JSON with scores (0-100) per pillar and a composite. Treat those numbers as ground truth. Do not contradict them in tone by more than a hair.
- Output must match the schema exactly.
- Be direct, personal, and specific. Use their role title and region when present.
- If data is missing (null fields), name the gap once in plain language, then focus on what we do know.

Tone (non-negotiable):
- Factual, not alarmist: only describe risk or decline when the inputs support it. No catastrophising, no "everything is collapsing" vibes. Layoff signals: if inputs say phase_4, not linked, or no signals, say that plainly. Never imply employer danger without data.
- Supportive, not generic: warmth should attach to their situation (their role, their scores, their gaps). No hollow cheerleading. No advice that could apply to any CV without change. Recommended actions must reference their mix, region, or numbers where possible.

Actions (each recommended action):
- 3 to 5 items, each doable this week, ordered by impact. Skip vague "network more" unless you tie it to their skill mix or goal.
- Every action MUST include career_os_href set to exactly one of these same-origin paths (no query strings, no external URLs): ${careerOsActionHrefListForPrompt()}
- Pick the path that matches the action: Skills for exposure or currency; Market for demand or pay; Feed for velocity or ongoing updates; Onboarding for profile or intake gaps; /careeros for home or cross-cutting; Health report only when you mean "re-run or review this scan".
- The detail line should say what the user does after they tap that screen, so the link feels earned, not decorative.`

export function buildCareerHealthUserPrompt(structuredJson: string): string {
  const allowed = careerOsActionHrefListForPrompt()
  const body = `Tone emphasis for this reply (apply on top of system instructions):
- Factual, not alarmist: infer only from the JSON. If a pillar is middling, say so calmly. If layoff data is missing, one honest sentence, then move on. Never invent headlines that sound worse than the scores.
- Supportive, not generic: opening and closing should sound written for this person. Actions must name why they matter for *their* profile (which pillar, which gap, which region or role).

Career_os_href (required on every recommended action). Use only these exact strings: ${allowed}

Structured inputs (JSON):
${structuredJson}

Write the narrative and recommended actions for this single-page Career Health Report. The composite score in the JSON is authoritative for the headline number (rounded for display is fine if you also state it clearly).`

  return appendWritingRules(body)
}

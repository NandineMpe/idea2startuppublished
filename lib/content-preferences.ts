/**
 * Founder content dismissals → CMO prompt tuning (last 10 reasons).
 */

import { supabaseAdmin } from "@/lib/supabase"

export const DISMISS_PRESET_IDS = [
  "wrong_tone",
  "not_relevant",
  "too_salesy",
  "bad_timing",
  "say_differently",
] as const

export type DismissPresetId = (typeof DISMISS_PRESET_IDS)[number] | "custom"

export const DISMISS_PRESET_LABELS: Record<string, string> = {
  wrong_tone: "Wrong tone",
  not_relevant: "Not relevant to my audience",
  too_salesy: "Too salesy",
  bad_timing: "Bad timing",
  say_differently: "I'd say it differently",
}

export const DISMISS_SELECT_OPTIONS = DISMISS_PRESET_IDS.map((id) => ({
  value: id,
  label: DISMISS_PRESET_LABELS[id],
}))

/** Build the single line we store and show to the LLM (Qwen). */
export function buildDismissalReasonText(
  reasonPreset: string | undefined | null,
  reasonDetail: string | undefined | null,
): string {
  const detail = reasonDetail?.trim() ?? ""
  const presetKey = reasonPreset?.trim() ?? ""
  const label =
    presetKey && DISMISS_PRESET_LABELS[presetKey] ? DISMISS_PRESET_LABELS[presetKey] : ""

  if (label && detail) return `${label} — ${detail}`
  if (label) return label
  if (detail) return detail
  return "Dismissed (no reason given)"
}

/** Paragraph for the LLM: recent founder rejections + inference hint. */
export function formatDismissalFeedbackForPrompt(reasonLines: string[]): string {
  const lines = reasonLines.filter((s) => s.trim().length > 0)
  if (lines.length === 0) return ""

  const numbered = lines.map((l, i) => `${i + 1}. ${l}`).join("\n")

  return `FOUNDER CONTENT FEEDBACK (recent dismissals — do not repeat these failure modes):
${numbered}

Infer this founder's preferences from the pattern above. For example, if several notes mention salesy tone, prefer a more technical, first-person narrative with minimal hype. If timing comes up, avoid time-sensitive hooks unless the brief strongly supports them. Apply these lessons to THIS generation.`
}

export async function loadDismissalFeedbackPromptSection(userId: string): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return ""
  }

  const { data, error } = await supabaseAdmin
    .from("content_preferences")
    .select("reason_text")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)

  if (error) {
    console.warn("[content-preferences] load:", error.message)
    return ""
  }

  const lines = (data ?? []).map((r) => String(r.reason_text ?? "").trim()).filter(Boolean)
  return formatDismissalFeedbackForPrompt(lines)
}

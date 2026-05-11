export const POSTING_SKILL_PROMPT_VERSION = "posting-skill-extract.v1"

export const POSTING_SKILL_EXTRACT_SYSTEM_PROMPT = `You extract required skills from job postings.

Rules:
- Return ONLY concrete skills explicitly present in the posting text.
- Map each skill to a canonical_skill_key in lowercase-hyphen format.
- Collapse obvious variants/synonyms (e.g. "go" and "golang" => "go", "js" => "javascript", "ts" => "typescript").
- Do not invent skills.
- Do not return generic words like "communication", "teamwork" unless clearly required as a named competency.
- Max 40 skills per posting.`

export function buildPostingSkillExtractUserPrompt(args: {
  postingText: string
  title?: string | null
  canonicalHints?: string[]
}): string {
  const hints =
    args.canonicalHints && args.canonicalHints.length > 0
      ? args.canonicalHints.slice(0, 200).join(", ")
      : "(none)"
  return [
    `Job Title: ${args.title ?? "(unknown)"}`,
    "",
    `Canonical skill hints (prefer these keys when applicable):`,
    hints,
    "",
    "Job posting text:",
    args.postingText.slice(0, 14000),
  ].join("\n")
}

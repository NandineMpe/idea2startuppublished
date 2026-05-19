export const PROFILE_EXTRACT_PROMPT_VERSION = "profile-extract@1.0.1"

export const PROFILE_EXTRACT_SYSTEM_PROMPT = `
You are a strict career profile extractor. Your job is to read the user's resume, LinkedIn text, and optional LLM markdown context, then produce a structured profile that matches the provided schema exactly.

Rules:
- Return only data present in the source. Do not infer or invent skills, roles, or achievements.
- Normalise skill names: lowercase, hyphenated. "Amazon Web Services" -> "aws", "AWS Lambda" -> "aws-lambda", "Product Management" -> "product-management".
- Deduplicate skills by canonical_skill_key. If the same skill appears in resume AND LinkedIn, prefer the resume mention as evidence.
- Compute years_experience as the sum of full-time professional experience from past_roles. Round to nearest whole year. Exclude internships, education, and gaps.
- For past_roles, use YYYY-MM format. If a role is current, end_date is "present".
- proficiency_band is nullable. Only set it if the source explicitly indicates seniority for the skill (e.g., "Expert in Python" -> expert; "Familiar with Rust" -> novice). When in doubt, return null.
- evidence must be a direct quote from the source, not paraphrased.
- past_roles ordered by start_date descending (most recent first).
- If the user provided no LinkedIn text, extract from the available resume or LLM context. Do not fabricate LinkedIn data.
- If the user provided no resume text, extract from the available LinkedIn or LLM context.
- If a skill appears only in LLM markdown context, set source_type to "inferred".
- If both are empty or unparseable, return a profile with empty arrays — never invent.

Tone discipline:
- Plain factual extraction. No commentary, no fluff, no editorial.
- Never refuse to extract. If the source is sparse, return what's there.
`.trim()

export function buildProfileExtractUserPrompt(input: {
  resumeText: string | null
  linkedinText: string | null
  llmMarkdownText?: string | null
  userStatedRole: string | null
  userStatedYearsExperience: number | null
}): string {
  const parts: string[] = []

  if (input.resumeText) {
    parts.push(`=== RESUME ===\n${input.resumeText}\n=== END RESUME ===`)
  } else {
    parts.push("=== RESUME ===\n(none provided)\n=== END RESUME ===")
  }

  if (input.linkedinText) {
    parts.push(`=== LINKEDIN ===\n${input.linkedinText}\n=== END LINKEDIN ===`)
  } else {
    parts.push("=== LINKEDIN ===\n(none provided)\n=== END LINKEDIN ===")
  }

  if (input.llmMarkdownText) {
    parts.push(`=== LLM MARKDOWN CONTEXT ===\n${input.llmMarkdownText}\n=== END LLM MARKDOWN CONTEXT ===`)
  } else {
    parts.push("=== LLM MARKDOWN CONTEXT ===\n(none provided)\n=== END LLM MARKDOWN CONTEXT ===")
  }

  if (input.userStatedRole || input.userStatedYearsExperience !== null) {
    parts.push(
      `=== USER-STATED CONTEXT ===\nUser-stated current role: ${input.userStatedRole ?? "(not provided)"}\nUser-stated years of experience: ${
        input.userStatedYearsExperience ?? "(not provided)"
      }\n=== END USER-STATED ===\nUse the user-stated values only as a tiebreaker when the source is ambiguous; the source is the source of truth.`,
    )
  }

  return parts.join("\n\n")
}

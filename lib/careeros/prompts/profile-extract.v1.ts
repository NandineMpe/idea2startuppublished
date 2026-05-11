export const PROFILE_EXTRACT_PROMPT_VERSION = "profile-extract@1.0.0"

export const PROFILE_EXTRACT_SYSTEM_PROMPT = `
You are a strict resume and LinkedIn profile extractor. Your job is to read the user's resume and LinkedIn text and produce a structured profile that matches the provided schema exactly.

Rules:
- Return only data present in the source. Do not infer or invent skills, roles, or achievements.
- Normalise skill names: lowercase, hyphenated. "Amazon Web Services" -> "aws", "AWS Lambda" -> "aws-lambda", "Product Management" -> "product-management".
- Deduplicate skills by canonical_skill_key. If the same skill appears in resume AND LinkedIn, prefer the resume mention as evidence.
- Compute years_experience as the sum of full-time professional experience from past_roles. Round to nearest whole year. Exclude internships, education, and gaps.
- For past_roles, use YYYY-MM format. If a role is current, end_date is "present".
- proficiency_band is nullable. Only set it if the source explicitly indicates seniority for the skill (e.g., "Expert in Python" -> expert; "Familiar with Rust" -> novice). When in doubt, return null.
- evidence must be a direct quote from the source, not paraphrased.
- past_roles ordered by start_date descending (most recent first).
- If the user provided no LinkedIn text, extract only from resume. Do not fabricate LinkedIn data.
- If the user provided no resume text, extract only from LinkedIn.
- If both are empty or unparseable, return a profile with empty arrays — never invent.

Tone discipline:
- Plain factual extraction. No commentary, no fluff, no editorial.
- Never refuse to extract. If the source is sparse, return what's there.
`.trim()

export function buildProfileExtractUserPrompt(input: {
  resumeText: string | null
  linkedinText: string | null
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

  if (input.userStatedRole || input.userStatedYearsExperience !== null) {
    parts.push(
      `=== USER-STATED CONTEXT ===\nUser-stated current role: ${input.userStatedRole ?? "(not provided)"}\nUser-stated years of experience: ${
        input.userStatedYearsExperience ?? "(not provided)"
      }\n=== END USER-STATED ===\nUse the user-stated values only as a tiebreaker when the source is ambiguous; the source is the source of truth.`,
    )
  }

  return parts.join("\n\n")
}

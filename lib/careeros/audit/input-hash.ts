import { createHash } from "crypto"

export interface ProfileExtractInput {
  user_id: string
  resume_text_hash: string | null
  linkedin_text_hash: string | null
  user_stated_role: string | null
  user_stated_years_experience: number | null
  schema_version: number
  prompt_version: string
}

function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj)
  if (Array.isArray(obj)) return "[" + obj.map(canonicalStringify).join(",") + "]"
  const keys = Object.keys(obj as Record<string, unknown>).sort()
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalStringify((obj as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  )
}

export function computeInputDataVersion(input: ProfileExtractInput): string {
  return createHash("sha256").update(canonicalStringify(input)).digest("hex")
}

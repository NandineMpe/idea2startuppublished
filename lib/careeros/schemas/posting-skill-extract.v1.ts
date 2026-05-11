import { z } from "zod"

export const POSTING_SKILL_EXTRACT_SCHEMA_VERSION = "posting-skill-extract.v1"

// Canonical keys are lowercased, hyphenated, no spaces.
const CanonicalSkillKey = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const PostingSkillExtractSchema = z.object({
  skills: z
    .array(
      z.object({
        canonical_skill_key: CanonicalSkillKey,
        skill_name: z.string().min(1).max(120),
      }),
    )
    .max(40),
})

export type PostingSkillExtract = z.infer<typeof PostingSkillExtractSchema>

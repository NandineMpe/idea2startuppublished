import { z } from "zod"

export const PROFILE_EXTRACTION_SCHEMA_VERSION = 1

export const PastRoleSchema = z.object({
  title: z.string().min(1).describe("Job title as written, normalised to title case"),
  company: z.string().min(1).describe("Employer name"),
  start_date: z.string().regex(/^\d{4}-\d{2}$/).describe("YYYY-MM format"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}$|^present$/)
    .describe("YYYY-MM or 'present' if current"),
  description: z.string().describe("Plain-text summary of responsibilities and achievements"),
  is_current: z.boolean().describe("True if end_date is 'present'"),
})

export const EducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1).describe("e.g. 'BSc Computer Science', 'MBA'"),
  field_of_study: z.string().nullable(),
  graduation_year: z.number().int().min(1950).max(2030).nullable(),
})

export const ExtractedSkillSchema = z.object({
  skill_name: z.string().min(1).describe("As written in source"),
  canonical_skill_key: z
    .string()
    .min(1)
    .describe(
      "Lowercased, hyphenated, normalised key (e.g. 'python', 'aws-lambda', 'product-management')",
    ),
  proficiency_band: z.enum(["novice", "intermediate", "advanced", "expert"]).nullable(),
  source_type: z.enum(["resume", "linkedin"]),
  evidence: z.string().describe("The exact phrase or sentence in the source that mentions this skill"),
})

export const ProfileExtractionSchema = z.object({
  current_role: z.string().describe("User's current job title — most recent role"),
  years_experience: z
    .number()
    .min(0)
    .max(70)
    .describe("Total years of full-time professional experience, computed from past roles"),
  skills: z.array(ExtractedSkillSchema).describe("All extracted skills, deduplicated by canonical_skill_key"),
  past_roles: z.array(PastRoleSchema).describe("Reverse chronological — most recent first"),
  education: z.array(EducationSchema),
  notable_achievements: z.array(z.string()).describe("Awards, publications, certifications, notable projects"),
})

export type ProfileExtraction = z.infer<typeof ProfileExtractionSchema>

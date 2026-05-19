import { createHash, randomUUID } from "crypto"
import { careerosInngest } from "../client"
import {
  type ProfileExtraction,
  ProfileExtractionSchema,
  PROFILE_EXTRACTION_SCHEMA_VERSION,
} from "@/lib/careeros/schemas/profile-extraction.v1"
import {
  PROFILE_EXTRACT_PROMPT_VERSION,
  PROFILE_EXTRACT_SYSTEM_PROMPT,
  buildProfileExtractUserPrompt,
} from "@/lib/careeros/prompts/profile-extract.v1"
import { qwenGenerateObject, QWEN_MODEL_NAME, QWEN_MODEL_VERSION } from "@/lib/careeros/ai/qwen"
import { computeInputDataVersion } from "@/lib/careeros/audit/input-hash"
import { mergeCareerOsOnboardingState } from "@/lib/careeros/onboarding/user-settings"
import { supabaseAdmin } from "@/lib/supabase"
import { sendCareerOSEvent } from "../client"

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

type SourceDocs = {
  resumeText: string | null
  linkedinText: string | null
  llmMarkdownText: string | null
  resumeDocId: string | null
  linkedinDocId: string | null
  llmMarkdownDocId: string | null
  userStatedRole: string | null
  userStatedYearsExperience: number | null
}

const MAX_LLM_MARKDOWN_SOURCE_CHARS = 120_000

function truncateSourceText(text: string | null | undefined): string | null {
  const trimmed = text?.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_LLM_MARKDOWN_SOURCE_CHARS)
}

async function loadOwnerBrainMarkdown(userId: string): Promise<string | null> {
  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("created_by_user_id", userId)
    .eq("is_personal", true)
    .maybeSingle()

  const organizationId = organization?.id as string | undefined
  if (!organizationId) return null

  const { data: profile, error } = await supabaseAdmin
    .from("company_profile")
    .select("knowledge_base_md")
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (error) throw error

  const text =
    typeof profile?.knowledge_base_md === "string" ? profile.knowledge_base_md : null
  return truncateSourceText(text)
}

const FALLBACK_SKILL_NAMES = [
  "python",
  "javascript",
  "typescript",
  "react",
  "next.js",
  "node.js",
  "sql",
  "postgres",
  "supabase",
  "aws",
  "excel",
  "financial modeling",
  "data analysis",
  "product management",
  "project management",
  "machine learning",
  "ai",
  "prompt engineering",
]

function canonicalSkillKey(skill: string): string {
  return skill.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function findEvidence(text: string, skill: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const hit = lines.find((line) => line.toLowerCase().includes(skill.toLowerCase()))
  return (hit ?? skill).slice(0, 240)
}

function buildFallbackExtraction(source: SourceDocs): ProfileExtraction {
  const combined = [source.resumeText, source.linkedinText, source.llmMarkdownText]
    .filter(Boolean)
    .join("\n")
  const lower = combined.toLowerCase()
  const skills = FALLBACK_SKILL_NAMES.filter((skill) => lower.includes(skill)).map((skill) => ({
    skill_name: skill,
    canonical_skill_key: canonicalSkillKey(skill),
    proficiency_band: null,
    source_type: "inferred" as const,
    evidence: findEvidence(combined, skill),
  }))

  return {
    current_role: source.userStatedRole ?? "",
    years_experience: source.userStatedYearsExperience ?? 0,
    skills,
    past_roles: [],
    education: [],
    notable_achievements: [],
  }
}

async function loadSourceDocuments(userId: string): Promise<SourceDocs> {
  const { data: docs, error: docsError } = await supabaseAdmin
    .schema("careeros")
    .from("user_documents")
    .select("id,doc_type,version")
    .eq("user_id", userId)
      .in("doc_type", ["resume", "linkedin", "llm_markdown"])
    .order("version", { ascending: false })
  if (docsError) throw docsError

  const latestByType = new Map<string, string>()
  for (const row of docs ?? []) {
    const t = row.doc_type as string
    if (!latestByType.has(t)) latestByType.set(t, row.id as string)
  }

  const docIds = [...latestByType.values()]
  let parsedByDocId = new Map<string, string>()
  if (docIds.length > 0) {
    const { data: ex, error: exError } = await supabaseAdmin
      .schema("careeros")
      .from("user_document_extractions")
      .select("user_document_id,parsed_payload,is_current")
      .in("user_document_id", docIds)
      .eq("is_current", true)
    if (exError) throw exError
    parsedByDocId = new Map<string, string>()
    for (const row of ex ?? []) {
      const payload = row.parsed_payload as { plain_text?: string } | null
      const text = payload?.plain_text?.trim() ?? ""
      if (text) parsedByDocId.set(row.user_document_id as string, text)
    }
  }

  const resumeDocId = latestByType.get("resume") ?? null
  const linkedinDocId = latestByType.get("linkedin") ?? null
  const llmMarkdownDocId = latestByType.get("llm_markdown") ?? null
  const resumeText = resumeDocId ? parsedByDocId.get(resumeDocId) ?? null : null
  const linkedinText = linkedinDocId ? parsedByDocId.get(linkedinDocId) ?? null : null
  let llmMarkdownText = llmMarkdownDocId ? parsedByDocId.get(llmMarkdownDocId) ?? null : null

  const { data: profile, error: profileError } = await supabaseAdmin
    .schema("careeros")
    .from("user_profiles")
    .select("current_role_title,years_experience")
    .eq("user_id", userId)
    .maybeSingle()
  if (profileError) throw profileError

  if (!llmMarkdownText) {
    const { data: settings, error: settingsError } = await supabaseAdmin
      .schema("careeros")
      .from("user_settings")
      .select("onboarding_state")
      .eq("user_id", userId)
      .maybeSingle()
    if (settingsError) throw settingsError

    const onboardingState =
      (settings?.onboarding_state as Record<string, unknown> | null | undefined) ?? {}
    const module11 =
      typeof onboardingState.module_1_1 === "object" && onboardingState.module_1_1 !== null
        ? (onboardingState.module_1_1 as Record<string, unknown>)
        : {}
    llmMarkdownText = truncateSourceText(
      typeof module11.latestLlmMarkdownText === "string"
        ? module11.latestLlmMarkdownText
        : null,
    )
  }

  if (!llmMarkdownText) {
    llmMarkdownText = await loadOwnerBrainMarkdown(userId)
  }

  return {
    resumeText,
    linkedinText,
    llmMarkdownText,
    resumeDocId,
    linkedinDocId,
    llmMarkdownDocId,
    userStatedRole: (profile?.current_role_title as string | null) ?? null,
    userStatedYearsExperience: (profile?.years_experience as number | null) ?? null,
  }
}

export const profileExtract = careerosInngest.createFunction(
  {
    id: "careeros-profile-extract",
    retries: 2,
    triggers: [{ event: "careeros/profile.extract" }],
  },
  async ({ event, step }) => {
    const { user_id: userId, onboarding_completion_id } = event.data

    await step.run("mark-running", async () => {
      await mergeCareerOsOnboardingState(userId, {
        module_1_2: {
          status: "running",
          startedAt: new Date().toISOString(),
          onboardingCompletionId: onboarding_completion_id,
        },
      })
    })

    try {
      const source = await step.run("load-source-documents", async () => loadSourceDocuments(userId))
      if (!source.resumeText && !source.linkedinText && !source.llmMarkdownText) {
        throw new Error("No resume, LinkedIn, or markdown context available")
      }

      const inputDataVersion = await step.run("compute-input-hash", async () =>
        computeInputDataVersion({
          user_id: userId,
          resume_text_hash: source.resumeText ? sha256(source.resumeText) : null,
          linkedin_text_hash: source.linkedinText ? sha256(source.linkedinText) : null,
          llm_markdown_hash: source.llmMarkdownText ? sha256(source.llmMarkdownText) : null,
          user_stated_role: source.userStatedRole,
          user_stated_years_experience: source.userStatedYearsExperience,
          schema_version: PROFILE_EXTRACTION_SCHEMA_VERSION,
          prompt_version: PROFILE_EXTRACT_PROMPT_VERSION,
        }),
      )

      const userPrompt = buildProfileExtractUserPrompt({
        resumeText: source.resumeText,
        linkedinText: source.linkedinText,
        llmMarkdownText: source.llmMarkdownText,
        userStatedRole: source.userStatedRole,
        userStatedYearsExperience: source.userStatedYearsExperience,
      })

      const started = Date.now()
      const { object: extraction, usage } = await step.run("qwen-extract", async () => {
        try {
          return await qwenGenerateObject({
            schema: ProfileExtractionSchema,
            systemPrompt: PROFILE_EXTRACT_SYSTEM_PROMPT,
            userPrompt,
          })
        } catch (error) {
          console.error(
            "[careeros-profile-extract] structured extraction failed, using fallback",
            error instanceof Error ? error.message : String(error),
          )
          return {
            object: buildFallbackExtraction(source),
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          }
        }
      })
      const latencyMs = Date.now() - started
      const outputHash = sha256(JSON.stringify(extraction))

      const extractionId = await step.run("write-extraction", async () => {
        const baseDocId = source.resumeDocId ?? source.linkedinDocId ?? source.llmMarkdownDocId
        if (!baseDocId) return null

        const { data: curr, error: currErr } = await supabaseAdmin
          .schema("careeros")
          .from("user_document_extractions")
          .select("id,extraction_version")
          .eq("user_document_id", baseDocId)
          .eq("parser_name", "careeros-profile-extract")
          .order("extraction_version", { ascending: false })
          .limit(1)
        if (currErr) throw currErr

        await supabaseAdmin
          .schema("careeros")
          .from("user_document_extractions")
          .update({ is_current: false })
          .eq("user_document_id", baseDocId)
          .eq("parser_name", "careeros-profile-extract")
          .eq("is_current", true)

        const nextVersion = ((curr?.[0]?.extraction_version as number | undefined) ?? 0) + 1
        const { data, error } = await supabaseAdmin
          .schema("careeros")
          .from("user_document_extractions")
          .insert({
            user_id: userId,
            user_document_id: baseDocId,
            parser_name: "careeros-profile-extract",
            parser_version: PROFILE_EXTRACT_PROMPT_VERSION,
            extraction_version: nextVersion,
            is_current: true,
            parsed_payload: extraction,
            input_data_version: inputDataVersion,
            source_attribution: {
              resume_used: Boolean(source.resumeText),
              linkedin_used: Boolean(source.linkedinText),
              llm_markdown_used: Boolean(source.llmMarkdownText),
              onboarding_completion_id,
            },
          })
          .select("id")
          .single()
        if (error) throw error
        return data.id as string
      })

      await step.run("upsert-user-skills", async () => {
        await supabaseAdmin
          .schema("careeros")
          .from("user_skills")
          .update({ is_active: false })
          .eq("user_id", userId)
          .eq("is_active", true)

        const seen = new Set<string>()
        const rows = extraction.skills
          .filter((s) => {
            if (seen.has(s.canonical_skill_key)) return false
            seen.add(s.canonical_skill_key)
            return true
          })
          .map((s) => ({
            user_id: userId,
            canonical_skill_key: s.canonical_skill_key,
            skill_name: s.skill_name,
            proficiency_band: s.proficiency_band,
            evidence_payload: { evidence: s.evidence, source: s.source_type },
            source_type: s.source_type,
            is_active: true,
            last_seen_at: new Date().toISOString(),
          }))

        if (rows.length > 0) {
          const { error } = await supabaseAdmin.schema("careeros").from("user_skills").insert(rows)
          if (error) throw error
        }
      })

      await step.run("update-user-profile", async () => {
        const currentRoleFromExtraction = extraction.past_roles.find((r) => r.is_current)?.title
        const { error } = await supabaseAdmin
          .schema("careeros")
          .from("user_profiles")
          .upsert(
            {
              user_id: userId,
              years_experience: source.userStatedYearsExperience ?? extraction.years_experience,
              current_role_title:
                source.userStatedRole ?? currentRoleFromExtraction ?? extraction.current_role,
            },
            { onConflict: "user_id" },
          )
        if (error) throw error
      })

      await step.run("write-generation-run", async () => {
        const { error } = await supabaseAdmin
          .schema("careeros")
          .from("generation_runs")
          .insert({
            id: randomUUID(),
            user_id: userId,
            artefact_table: "careeros.user_document_extractions",
            artefact_id: extractionId,
            workflow_name: "careeros/profile.extract",
            provider: "qwen",
            model_name: QWEN_MODEL_NAME,
            model_version: QWEN_MODEL_VERSION,
            prompt_version: PROFILE_EXTRACT_PROMPT_VERSION,
            schema_version: String(PROFILE_EXTRACTION_SCHEMA_VERSION),
            input_data_version: inputDataVersion,
            source_attribution: {
              resume_used: Boolean(source.resumeText),
              linkedin_used: Boolean(source.linkedinText),
              llm_markdown_used: Boolean(source.llmMarkdownText),
            },
            input_hash: inputDataVersion,
            output_hash: outputHash,
            latency_ms: latencyMs,
            token_usage: usage,
            status: "completed",
          })
        if (error) throw error
      })

      await step.run("mark-completed", async () => {
        await mergeCareerOsOnboardingState(userId, {
          module_1_2: {
            status: "completed",
            completedAt: new Date().toISOString(),
            skillsCount: extraction.skills.length,
            topSkills: extraction.skills.slice(0, 8).map((s) => s.skill_name),
            suggestedRoles: extraction.past_roles.slice(0, 3).map((r) => r.title),
            ...(extractionId ? { extractionId } : {}),
          },
        })
      })

      await step.run("enqueue-onet-map", async () => {
        await sendCareerOSEvent({
          name: "careeros/profile.onet-map",
          data: { user_id: userId },
        })
      })

      await step.run("enqueue-skills-embed", async () => {
        await sendCareerOSEvent({
          name: "careeros/skills.embed",
          data: { user_id: userId },
        })
      })

      await step.run("enqueue-half-life-computation", async () => {
        await sendCareerOSEvent({
          name: "careeros/skills.compute-half-life-for-user",
          data: { user_id: userId },
        })
      })

      return {
        user_id: userId,
        extraction_id: extractionId,
        skills_count: extraction.skills.length,
        past_roles_count: extraction.past_roles.length,
        onboarding_completion_id,
      }
    } catch (error) {
      await step.run("mark-failed", async () => {
        await mergeCareerOsOnboardingState(userId, {
          module_1_2: {
            status: "failed",
            failedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          },
        })
      })
      throw error
    }
  },
)

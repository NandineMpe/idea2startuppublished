import { generateText } from "ai"
import { qwenModel } from "@/lib/llm-provider"
import { sha256Hex } from "@/lib/careeros/hash"
import { mergeCareerOsOnboardingState } from "@/lib/careeros/onboarding/user-settings"
import { supabaseAdmin } from "@/lib/supabase"

type SkillItem = {
  skill: string
  proficiencyBand: "beginner" | "intermediate" | "advanced"
  confidence: number
  evidence?: string
}

type ExtractionResult = {
  summary: string
  topSkills: SkillItem[]
  suggestedRoles: string[]
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
}

function toBand(v: unknown): SkillItem["proficiencyBand"] {
  if (v === "advanced" || v === "intermediate" || v === "beginner") return v
  return "intermediate"
}

function canonicalSkillKey(skill: string): string {
  return skill.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80)
}

async function latestDocTextByType(userId: string): Promise<Record<string, string>> {
  const { data: docs, error: docError } = await supabaseAdmin
    .schema("careeros")
    .from("user_documents")
    .select("id,doc_type,version")
    .eq("user_id", userId)
    .in("doc_type", ["resume", "linkedin", "llm_markdown"])
    .order("version", { ascending: false })

  if (docError) throw docError

  const latestByType = new Map<string, string>()
  for (const d of docs ?? []) {
    const docType = d.doc_type as string
    if (!latestByType.has(docType)) latestByType.set(docType, d.id as string)
  }
  const ids = [...latestByType.values()]
  if (ids.length === 0) return {}

  const { data: ex, error: exError } = await supabaseAdmin
    .schema("careeros")
    .from("user_document_extractions")
    .select("user_document_id,parsed_payload,is_current")
    .in("user_document_id", ids)
    .eq("is_current", true)

  if (exError) throw exError

  const textByDocId = new Map<string, string>()
  for (const row of ex ?? []) {
    const payload = row.parsed_payload as { plain_text?: string } | null
    const plain = payload?.plain_text?.trim()
    if (plain) textByDocId.set(row.user_document_id as string, plain)
  }

  const out: Record<string, string> = {}
  for (const [docType, docId] of latestByType.entries()) {
    const txt = textByDocId.get(docId)
    if (txt) out[docType] = txt
  }
  return out
}

function parseExtraction(payload: Record<string, unknown>): ExtractionResult {
  const rawSkills = Array.isArray(payload.topSkills) ? payload.topSkills : []
  const topSkills: SkillItem[] = rawSkills
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const obj = item as Record<string, unknown>
      const skill = asString(obj.skill)
      if (!skill) return null
      const confidenceNum = Number(obj.confidence)
      return {
        skill,
        proficiencyBand: toBand(obj.proficiencyBand),
        confidence:
          Number.isFinite(confidenceNum) && confidenceNum >= 0 && confidenceNum <= 1
            ? confidenceNum
            : 0.5,
        evidence: asString(obj.evidence) ?? undefined,
      } satisfies SkillItem
    })
    .filter((x): x is SkillItem => x !== null)
    .slice(0, 25)

  return {
    summary: asString(payload.summary) ?? "Career profile extraction complete.",
    topSkills,
    suggestedRoles: asStringArray(payload.suggestedRoles).slice(0, 10),
  }
}

async function saveInferredSkills(userId: string, parsed: ExtractionResult): Promise<void> {
  await supabaseAdmin
    .schema("careeros")
    .from("user_skills")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("source_type", "inferred")
    .eq("is_active", true)

  if (parsed.topSkills.length === 0) return

  const seen = new Set<string>()
  const rows = parsed.topSkills
    .map((s) => {
      const key = canonicalSkillKey(s.skill)
      if (!key || seen.has(key)) return null
      seen.add(key)
      const proficiencyScore =
        s.proficiencyBand === "advanced" ? 85 : s.proficiencyBand === "intermediate" ? 60 : 35
      return {
        user_id: userId,
        canonical_skill_key: key,
        skill_name: s.skill,
        proficiency_score: proficiencyScore,
        proficiency_band: s.proficiencyBand,
        evidence_payload: s.evidence ? [{ source: "module_1_2_qwen", evidence: s.evidence }] : [],
        source_type: "inferred" as const,
        is_active: true,
        onet_mapping_payload: { confidence: s.confidence },
        last_seen_at: new Date().toISOString(),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) return

  const { error } = await supabaseAdmin.schema("careeros").from("user_skills").insert(rows)
  if (error) throw error
}

export async function runModule12SkillExtraction(userId: string): Promise<ExtractionResult> {
  const docs = await latestDocTextByType(userId)

  const { data: profile, error: profileError } = await supabaseAdmin
    .schema("careeros")
    .from("user_profiles")
    .select("current_role_title,target_role_title,location_label,years_experience")
    .eq("user_id", userId)
    .maybeSingle()
  if (profileError) throw profileError

  const promptInput = {
    profile: profile ?? {},
    documents: {
      resume: (docs.resume ?? "").slice(0, 15000),
      linkedin: (docs.linkedin ?? "").slice(0, 12000),
      llm_markdown: (docs.llm_markdown ?? "").slice(0, 12000),
    },
  }

  const inputJson = JSON.stringify(promptInput)
  const inputHash = sha256Hex(inputJson)

  await mergeCareerOsOnboardingState(userId, {
    module_1_2: {
      status: "running",
      startedAt: new Date().toISOString(),
    },
  })

  const { text } = await generateText({
    model: qwenModel(),
    temperature: 0.1,
    prompt: `You are a career skill extraction engine for CareerOS Module 1.2.
Return ONLY valid JSON with this exact shape:
{
  "summary": "string",
  "topSkills": [
    {
      "skill": "string",
      "proficiencyBand": "beginner|intermediate|advanced",
      "confidence": 0.0,
      "evidence": "short evidence quote"
    }
  ],
  "suggestedRoles": ["string"]
}

Rules:
- Use only information found in input.
- Top skills max 25.
- Confidence between 0 and 1.
- No markdown fences.

INPUT:
${inputJson}`,
  })

  const outputHash = sha256Hex(text)
  const parsedRaw = parseJsonObject(text)
  if (!parsedRaw) throw new Error("Qwen extraction did not return valid JSON")
  const parsed = parseExtraction(parsedRaw)

  await saveInferredSkills(userId, parsed)

  await supabaseAdmin.schema("careeros").from("generation_runs").insert({
    user_id: userId,
    artefact_table: "careeros.user_skills",
    workflow_name: "careeros/onboarding/module-1-2-skill-extraction",
    provider: "qwen",
    model_name: "qwen",
    model_version: "module-1-2",
    prompt_version: "1",
    schema_version: "1",
    input_data_version: inputHash,
    source_attribution: { documents: Object.keys(docs) },
    input_hash: inputHash,
    output_hash: outputHash,
    status: "completed",
    token_usage: {},
  })

  await mergeCareerOsOnboardingState(userId, {
    module_1_2: {
      status: "completed",
      completedAt: new Date().toISOString(),
      skillsCount: parsed.topSkills.length,
      topSkills: parsed.topSkills.slice(0, 5).map((s) => s.skill),
      suggestedRoles: parsed.suggestedRoles,
    },
  })

  return parsed
}

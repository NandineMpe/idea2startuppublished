import { z } from "zod"
import { claudeGenerateObject } from "@/lib/careeros/ai/claude"
import { buildSkillEmbeddingInput, embedSkillInputText } from "@/lib/careeros/ai/skill-embedding"
import { rankByEmbedding } from "@/lib/careeros/onet/cosine"
import { supabaseAdmin } from "@/lib/supabase"

export type UserSkillRow = {
  id: string
  skill_name: string
  canonical_skill_key: string | null
  source_type: string | null
  evidence_payload?: unknown
}

export type OnetSkillCandidate = { id: string; name: string }

export type SkillMappingDecision = {
  user_skill_id: string
  onet_skill_id: string | null
  onet_skill_name: string | null
  vector_similarity: number | null
  claude_confidence: number
  needs_review: boolean
  method: string
}

const batchSchema = z.object({
  mappings: z.array(
    z.object({
      user_skill_id: z.string(),
      onet_skill_id: z.string().nullable(),
      onet_skill_name: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      needs_review: z.boolean(),
      note: z.string().max(200).optional(),
    }),
  ),
})

async function loadOnetSkillsCacheCandidates(limit = 800): Promise<OnetSkillCandidate[]> {
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("onet_skills_cache")
    .select("onet_skill_id,name")
    .limit(limit)

  if (error || !data?.length) return []

  const seen = new Set<string>()
  const out: OnetSkillCandidate[] = []
  for (const row of data) {
    const id = String(row.onet_skill_id ?? "").trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({ id, name: String(row.name ?? id).trim() })
  }
  return out
}

function mergeCandidatePools(
  occupationSkills: OnetSkillCandidate[],
  cacheSkills: OnetSkillCandidate[],
): OnetSkillCandidate[] {
  const byId = new Map<string, OnetSkillCandidate>()
  for (const s of [...occupationSkills, ...cacheSkills]) {
    if (s.id && s.name) byId.set(s.id, s)
  }
  return [...byId.values()]
}

async function embedCandidates(candidates: OnetSkillCandidate[]): Promise<
  Array<OnetSkillCandidate & { embedding: number[] }>
> {
  const batchSize = 40
  const out: Array<OnetSkillCandidate & { embedding: number[] }> = []
  for (let i = 0; i < candidates.length; i += batchSize) {
    const slice = candidates.slice(i, i + batchSize)
    const embedded = await Promise.all(
      slice.map(async (c) => ({
        ...c,
        embedding: await embedSkillInputText(`O*NET skill: ${c.name}`),
      })),
    )
    out.push(...embedded)
  }
  return out
}

/**
 * Per user skill: vector top-5 from occupation + cache pool, then Claude batch confirmation.
 */
export async function matchSkillsWithVectorAndClaude(args: {
  userSkills: UserSkillRow[]
  occupationSkills: OnetSkillCandidate[]
  profileSummary: string
  socCode: string
}): Promise<SkillMappingDecision[]> {
  const { userSkills, occupationSkills, profileSummary, socCode } = args
  if (userSkills.length === 0) return []

  const cacheSkills = await loadOnetSkillsCacheCandidates()
  const pool = mergeCandidatePools(occupationSkills, cacheSkills)
  if (pool.length === 0) {
    return userSkills.map((s) => ({
      user_skill_id: s.id,
      onet_skill_id: null,
      onet_skill_name: null,
      vector_similarity: null,
      claude_confidence: 0,
      needs_review: true,
      method: "no_onet_skill_pool",
    }))
  }

  const embeddedPool = await embedCandidates(pool)
  const decisions: SkillMappingDecision[] = []

  const batchSize = 8
  for (let i = 0; i < userSkills.length; i += batchSize) {
    const batch = userSkills.slice(i, i + batchSize)
    const claudeRows: Array<{
      user_skill_id: string
      skill_name: string
      top_candidates: Array<{ id: string; name: string; similarity: number }>
    }> = []

    for (const row of batch) {
      const queryText = buildSkillEmbeddingInput({
        skill_name: row.skill_name,
        source_type: row.source_type,
        evidence_payload: row.evidence_payload,
      })
      const queryVec = await embedSkillInputText(queryText)
      const top = rankByEmbedding(queryVec, embeddedPool, 5).map((t) => ({
        id: t.id,
        name: t.name,
        similarity: t.similarity,
      }))
      claudeRows.push({
        user_skill_id: row.id,
        skill_name: row.skill_name,
        top_candidates: top,
      })
    }

    const promptBody = claudeRows
      .map((r) => {
        const cand =
          r.top_candidates.length === 0
            ? "  (no vector candidates)"
            : r.top_candidates
                .map(
                  (c, idx) =>
                    `  ${idx + 1}. ${c.id} — ${c.name} (sim ${c.similarity.toFixed(3)})`,
                )
                .join("\n")
        return `Skill id ${r.user_skill_id}: "${r.skill_name}"\nCandidates:\n${cand}`
      })
      .join("\n\n")

    const { object } = await claudeGenerateObject({
      schema: batchSchema,
      system: `You map user career skills to O*NET Content Model element IDs for SOC ${socCode}.
For each skill, pick the best candidate onet_skill_id from its list, or null if none fit (novel/emerging skill).
Set needs_review true when confidence < 0.55 or when you pick null.
Do not invent IDs. Plain text only in notes.`,
      prompt: `Profile context:
${profileSummary}

Map each skill:

${promptBody}`,
      maxOutputTokens: 2500,
    })

    const byId = new Map(object.mappings.map((m) => [m.user_skill_id, m]))

    for (const row of batch) {
      const m = byId.get(row.id)
      const vectorTop = claudeRows.find((r) => r.user_skill_id === row.id)?.top_candidates[0]

      if (!m) {
        decisions.push({
          user_skill_id: row.id,
          onet_skill_id: null,
          onet_skill_name: null,
          vector_similarity: vectorTop?.similarity ?? null,
          claude_confidence: 0,
          needs_review: true,
          method: "vector_claude_v1_missing_row",
        })
        continue
      }

      const onetId = m.onet_skill_id?.trim() || null
      const validId =
        onetId && embeddedPool.some((p) => p.id === onetId) ? onetId : null

      decisions.push({
        user_skill_id: row.id,
        onet_skill_id: validId,
        onet_skill_name: m.onet_skill_name?.trim() || null,
        vector_similarity: vectorTop?.similarity ?? null,
        claude_confidence: m.confidence,
        needs_review: m.needs_review || !validId || m.confidence < 0.55,
        method: "vector_claude_v1",
      })
    }
  }

  return decisions
}

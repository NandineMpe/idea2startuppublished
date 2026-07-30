import { z } from "zod"
import { claudeGenerateObject } from "@/lib/careeros/ai/claude"
import { embedSkillInputText } from "@/lib/careeros/ai/skill-embedding"
import { rankByEmbedding } from "@/lib/careeros/onet/cosine"
import {
  fetchOnetKeywordSearchDetailed,
  type OnetOccupationHit,
} from "@/lib/careeros/integrations/onet-request"

export type OccupationMatchContext = {
  current_role_title: string | null
  target_role_title: string | null
  years_experience: number | null
  top_skill_names: string[]
  location_label: string | null
}

export type OccupationMatchResult = {
  soc_code: string
  title: string
  vector_rank: number
  vector_similarity: number
  claude_confidence: number
  method: "vector_claude_v1"
  candidates_considered: number
  rationale: string | null
}

const pickSchema = z.object({
  soc_code: z.string().describe("Best O*NET-SOC code from candidates, or empty if none fit"),
  title: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(400),
})

function buildRoleEmbeddingText(ctx: OccupationMatchContext): string {
  const lines = [
    `Current role: ${ctx.current_role_title ?? "unknown"}`,
    ctx.target_role_title ? `Target role: ${ctx.target_role_title}` : "",
    typeof ctx.years_experience === "number" ? `Years experience: ${ctx.years_experience}` : "",
    ctx.location_label ? `Location: ${ctx.location_label}` : "",
    ctx.top_skill_names.length
      ? `Key skills: ${ctx.top_skill_names.slice(0, 12).join(", ")}`
      : "",
  ].filter(Boolean)
  return lines.join("\n")
}

function dedupeHits(hits: OnetOccupationHit[]): OnetOccupationHit[] {
  const seen = new Set<string>()
  const out: OnetOccupationHit[] = []
  for (const h of hits) {
    const soc = h.soc_code?.trim()
    if (!soc || seen.has(soc)) continue
    seen.add(soc)
    out.push({ soc_code: soc, title: h.title?.trim() || soc })
  }
  return out
}

/**
 * Step 1: O*NET keyword search (+ optional cache hits passed in).
 * Step 2: Embed role context vs candidate titles, keep top 5.
 * Step 3: Claude picks best SOC given full profile context.
 */
export async function matchOccupationWithVectorAndClaude(
  ctx: OccupationMatchContext,
  options?: { extraCandidates?: OnetOccupationHit[]; topK?: number },
): Promise<OccupationMatchResult | null> {
  const topK = options?.topK ?? 5
  const keywords = [
    ctx.current_role_title?.trim(),
    ctx.target_role_title?.trim(),
  ].filter((k): k is string => Boolean(k))

  const allHits: OnetOccupationHit[] = [...(options?.extraCandidates ?? [])]

  for (const kw of keywords.length ? keywords : ["professional"]) {
    const search = await fetchOnetKeywordSearchDetailed(kw)
    if (search.ok && search.hits.length) {
      allHits.push(...search.hits)
    }
  }

  const candidates = dedupeHits(allHits).slice(0, 20)
  if (candidates.length === 0) return null

  const roleText = buildRoleEmbeddingText(ctx)
  const roleVec = await embedSkillInputText(roleText)

  const embedded = await Promise.all(
    candidates.map(async (c) => ({
      id: c.soc_code,
      soc_code: c.soc_code,
      title: c.title,
      embedding: await embedSkillInputText(`Occupation: ${c.title}\nSOC: ${c.soc_code}`),
    })),
  )

  const ranked = rankByEmbedding(roleVec, embedded, topK)
  if (ranked.length === 0) return null

  const candidateBlock = ranked
    .map(
      (c, i) =>
        `${i + 1}. SOC ${c.soc_code} — ${c.title} (vector similarity ${c.similarity.toFixed(3)})`,
    )
    .join("\n")

  const { object } = await claudeGenerateObject({
    schema: pickSchema,
    system: `You map a professional's career profile to exactly one O*NET occupation code from the candidate list.
Pick the best match using role title, target role, years of experience, location, and skills.
If none of the candidates fit well, return soc_code as empty string and confidence below 0.4.
Use only SOC codes from the list. Plain text in rationale, no markdown.`,
    prompt: `Profile:
${roleText}

Candidates (pre-ranked by embedding similarity):
${candidateBlock}

Return the single best O*NET-SOC match.`,
    maxOutputTokens: 800,
  })

  const pickedSoc = object.soc_code?.trim() || ""
  const rankedPick = ranked.find((r) => r.soc_code === pickedSoc) ?? ranked[0]!

  if (!pickedSoc && object.confidence < 0.4) {
    return null
  }

  const finalSoc = pickedSoc || rankedPick.soc_code
  const finalTitle =
    object.title?.trim() ||
    ranked.find((r) => r.soc_code === finalSoc)?.title ||
    rankedPick.title

  return {
    soc_code: finalSoc,
    title: finalTitle,
    vector_rank: ranked.findIndex((r) => r.soc_code === finalSoc) + 1,
    vector_similarity: ranked.find((r) => r.soc_code === finalSoc)?.similarity ?? rankedPick.similarity,
    claude_confidence: object.confidence,
    method: "vector_claude_v1",
    candidates_considered: candidates.length,
    rationale: object.rationale?.trim() || null,
  }
}

/**
 * GET /api/careeros/_verify/skill-graph?token=&user_id=
 * Module 1.4 diagnostic — gated by VERIFY_TOKEN; uses service role for aggregates.
 * Does not log raw embeddings or full vectors (similarities only).
 */
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function parseVector(raw: unknown): number[] | null {
  if (!raw) return null
  if (Array.isArray(raw) && raw.every((x) => typeof x === "number")) return raw as number[]
  if (typeof raw === "string") {
    const s = raw.trim()
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const arr = JSON.parse(s) as unknown
        if (Array.isArray(arr) && arr.every((x) => typeof x === "number")) return arr
      } catch {
        return null
      }
    }
  }
  return null
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

function completenessScore(p: {
  current_role_title?: string | null
  years_experience?: number | null
  location_region_code?: string | null
  onet_soc_code?: string | null
}): number {
  let ok = 0
  const total = 4
  if (p.current_role_title?.trim()) ok += 1
  if (typeof p.years_experience === "number") ok += 1
  if (p.location_region_code?.trim()) ok += 1
  if (p.onet_soc_code?.trim()) ok += 1
  return Math.round((ok / total) * 100) / 100
}

export async function GET(
  request: Request,
  context: { params: Promise<{ verify: string }> },
) {
  const { verify } = await context.params
  if (verify !== "_verify") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token || token !== process.env.VERIFY_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = url.searchParams.get("user_id")?.trim()
  if (!userId?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
    return NextResponse.json({ error: "Missing or invalid user_id (UUID)" }, { status: 400 })
  }

  const issues: string[] = []

  const { data: profile, error: profileError } = await supabaseAdmin
    .schema("careeros")
    .from("user_profiles")
    .select(
      "current_role_title,years_experience,location_region_code,onet_soc_code,onet_mapping_confidence",
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!profile) {
    issues.push("no_user_profiles_row")
  }

  const { data: skillsActive, error: skillsError } = await supabaseAdmin
    .schema("careeros")
    .from("user_skills")
    .select("id,skill_name,onet_skill_id,source_type,is_active")
    .eq("user_id", userId)
    .eq("is_active", true)

  if (skillsError) {
    return NextResponse.json({ error: skillsError.message }, { status: 500 })
  }

  const activeList = skillsActive ?? []
  const mapped_to_onet = activeList.filter((s) => (s.onet_skill_id as string | null)?.trim()).length
  const unmapped = activeList.length - mapped_to_onet

  const skillIds = activeList.map((s) => s.id as string)

  let embRows: Array<{
    user_skill_id: string
    embedding_model: unknown
    embedding_dim: unknown
    embedding_version: unknown
    embedding: unknown
  }> = []

  if (skillIds.length > 0) {
    const { data, error: embError } = await supabaseAdmin
      .schema("careeros")
      .from("user_skill_embeddings")
      .select("user_skill_id,embedding_model,embedding_dim,embedding_version,embedding")
      .eq("user_id", userId)
      .in("user_skill_id", skillIds)

    if (embError) {
      return NextResponse.json({ error: embError.message }, { status: 500 })
    }
    embRows = data ?? []
  }

  const embeddingsFiltered = embRows

  const embBySkillId = new Map<string, (typeof embeddingsFiltered)[0]>()
  for (const row of embeddingsFiltered) {
    embBySkillId.set(row.user_skill_id as string, row)
  }

  let missing_embeddings = 0
  for (const s of activeList) {
    if (!embBySkillId.has(s.id as string)) missing_embeddings += 1
  }

  if (missing_embeddings > 0) {
    issues.push(`missing_embeddings_for_active_skills:${missing_embeddings}`)
  }

  const firstEmb = embeddingsFiltered[0]
  const embeddingsMeta =
    firstEmb != null
      ? {
          model: firstEmb.embedding_model as string,
          version: firstEmb.embedding_version as string,
          dimension: firstEmb.embedding_dim as number,
        }
      : {
          model: "none",
          version: "none",
          dimension: 1536,
        }

  const labeled: Array<{ skill_name: string; vec: number[] | null }> = []
  for (const s of activeList) {
    const erow = embBySkillId.get(s.id as string)
    const vec = erow ? parseVector(erow.embedding) : null
    labeled.push({
      skill_name: (s.skill_name as string) ?? "",
      vec,
    })
    if (erow && !vec) issues.push("embedding_parse_failed_for_skill_row")
  }

  let sample_similarity: {
    anchor_skill: string | null
    top_5_similar: Array<{ skill: string; similarity: number }>
  } = { anchor_skill: null, top_5_similar: [] }

  const withVec = labeled.filter((x) => x.vec && x.vec.length > 0)
  if (withVec.length >= 2) {
    const anchor =
      withVec.find((x) => x.skill_name.toLowerCase().includes("python")) ?? withVec[0]
    if (anchor?.vec) {
      sample_similarity.anchor_skill = anchor.skill_name.toLowerCase().includes("python")
        ? "python"
        : anchor.skill_name.slice(0, 48)
      const ranked = withVec
        .filter((x) => x.skill_name !== anchor.skill_name)
        .map((x) => ({
          skill: x.skill_name,
          similarity: cosineSimilarity(anchor.vec!, x.vec!),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5)
        .map((x) => ({
          skill: x.skill.slice(0, 80),
          similarity: Math.round(x.similarity * 10000) / 10000,
        }))
      sample_similarity.top_5_similar = ranked
    }
  } else if (activeList.length > 0 && withVec.length === 0) {
    issues.push("no_parseable_embeddings_for_similarity_sample")
  }

  const by_source: Record<string, number> = { resume: 0, linkedin: 0, manual: 0, inferred: 0 }
  for (const s of activeList) {
    const st = (s.source_type as string) ?? "unknown"
    if (st in by_source) by_source[st] += 1
  }

  let occupation_cache_title: string | null = null
  const soc = profile?.onet_soc_code as string | null | undefined
  if (soc?.trim()) {
    const { data: occ } = await supabaseAdmin
      .schema("careeros")
      .from("onet_occupations_cache")
      .select("title")
      .eq("onet_soc_code", soc.trim())
      .limit(1)
      .maybeSingle()
    occupation_cache_title = (occ?.title as string | undefined) ?? null
  }

  return NextResponse.json({
    user_id: userId,
    profile: profile
      ? {
          current_role_title: profile.current_role_title ?? null,
          years_experience: profile.years_experience ?? null,
          location_region_code: profile.location_region_code ?? null,
          onet_soc_code: profile.onet_soc_code ?? null,
          onet_mapping_confidence: profile.onet_mapping_confidence ?? null,
          completeness_score: completenessScore(profile),
          onet_occupation_title_from_cache: occupation_cache_title,
        }
      : null,
    skills: {
      total_active: activeList.length,
      mapped_to_onet,
      unmapped,
      with_embeddings: activeList.length - missing_embeddings,
      missing_embeddings,
      by_source,
    },
    embeddings: embeddingsMeta,
    sample_similarity,
    issues,
  })
}

import { randomUUID } from "crypto"
import { qwenGenerateObject, QWEN_MODEL_NAME, QWEN_MODEL_VERSION } from "@/lib/careeros/ai/qwen"
import { formatVectorLiteral, getOpenAiEmbeddingApiKey } from "@/lib/careeros/ai/skill-embedding"
import { FEED_ENRICHMENT_SYSTEM_PROMPT, FEED_ENRICH_PROMPT_VERSION } from "@/lib/careeros/prompts/feed-enrich.v1"
import { FEED_PERSONALISE_PROMPT_VERSION, FEED_PERSONALISE_SYSTEM_PROMPT } from "@/lib/careeros/prompts/feed-personalise.v1"
import { FeedItemEnrichmentSchema, FEED_ENRICHMENT_SCHEMA_VERSION } from "@/lib/careeros/schemas/feed-item-enrichment.v1"
import { PersonalisedNoteSchema, PERSONALISED_NOTE_SCHEMA_VERSION } from "@/lib/careeros/schemas/personalised-note.v1"
import {
  adaptiveThreshold,
  classifyItemFunction,
  deriveFunctionProfile,
  evaluatePolicyGate,
  resolveUserSegment,
  type EngagementSignals,
} from "@/lib/careeros/feed/policy"
import { supabaseAdmin } from "@/lib/supabase"
import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"
import { isLlmConfigured } from "@/lib/llm-provider"

export const FEED_RELEVANCE_THRESHOLD = 0.55

function heuristicEntityType(text: string): "model_release" | "research_finding" | "product_launch" | "policy" | "industry_news" {
  const t = text.toLowerCase()
  if (/(model|release|launch|api|agent)/.test(t)) return "model_release"
  if (/(paper|arxiv|research|benchmark)/.test(t)) return "research_finding"
  if (/(policy|regulation|act|compliance)/.test(t)) return "policy"
  if (/(product|feature|integration|sdk)/.test(t)) return "product_launch"
  return "industry_news"
}

function heuristicSkills(text: string): string[] {
  const t = text.toLowerCase()
  const map: Array<[RegExp, string]> = [
    [/llm|large language|gpt|claude/, "ai-llm"],
    [/agent|computer use/, "ai-agents"],
    [/python/, "python"],
    [/typescript|javascript/, "typescript"],
    [/api/, "api-design"],
    [/kubernetes|k8s/, "kubernetes"],
    [/ml|machine learning/, "machine-learning"],
    [/data/, "data-engineering"],
    [/security|cyber/, "cybersecurity"],
  ]
  const out = new Set<string>()
  for (const [rx, skill] of map) if (rx.test(t)) out.add(skill)
  return [...out]
}

export async function persistFeedSourceItems(items: RawFeedItem[]) {
  if (!items.length) return { insertedIds: [] as string[], insertedCount: 0 }
  const rows = items.map((i) => ({
    source_key: i.source_key,
    source_item_id: i.source_item_id,
    title: i.title,
    body: i.body,
    url: i.url,
    published_at: i.published_at.toISOString(),
    authors: i.authors ?? [],
    raw_payload: i.raw_payload,
  }))
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("feed_source_items")
    .upsert(rows, { onConflict: "source_key,source_item_id", ignoreDuplicates: true })
    .select("id")
  if (error) throw error
  return {
    insertedIds: (data ?? []).map((r) => String(r.id)),
    insertedCount: (data ?? []).length,
  }
}

export async function embedFeedText(input: string): Promise<number[]> {
  const apiKey = getOpenAiEmbeddingApiKey()
  if (!apiKey) {
    // Deterministic fallback embedding when OpenAI key is unavailable.
    const out = new Array<number>(1536).fill(0)
    const text = input.toLowerCase()
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i)
      const idx = code % 1536
      out[idx] += 1
    }
    const norm = Math.sqrt(out.reduce((acc, v) => acc + v * v, 0)) || 1
    return out.map((v) => Number((v / norm).toFixed(8)))
  }
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: input.slice(0, 8000),
      dimensions: 1536,
    }),
  })
  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }>; error?: { message?: string } }
  if (!res.ok) throw new Error(json.error?.message ?? `embedding failed ${res.status}`)
  const vec = json.data?.[0]?.embedding
  if (!vec || vec.length !== 1536) throw new Error("Unexpected feed embedding shape")
  return vec
}

export async function enrichFeedSourceItem(sourceItemId: string) {
  const { data: sourceItem, error: srcErr } = await supabaseAdmin
    .schema("careeros")
    .from("feed_source_items")
    .select("id,source_key,title,body,url,published_at,raw_payload")
    .eq("id", sourceItemId)
    .maybeSingle()
  if (srcErr) throw srcErr
  if (!sourceItem) throw new Error(`Missing feed source item ${sourceItemId}`)

  const llmReady = isLlmConfigured()
  const { object, usage } = llmReady
    ? await qwenGenerateObject({
        schema: FeedItemEnrichmentSchema,
        systemPrompt: FEED_ENRICHMENT_SYSTEM_PROMPT,
        userPrompt: `Source: ${sourceItem.source_key}\nTitle: ${sourceItem.title}\nPublished: ${sourceItem.published_at}\nURL: ${sourceItem.url}\nBody:\n${String(sourceItem.body ?? "").slice(0, 6000)}`,
      })
    : {
        object: {
          enriched_summary: `${String(sourceItem.title)}. ${String(sourceItem.body ?? "").slice(0, 320)}`.slice(0, 500),
          entity_type: heuristicEntityType(`${sourceItem.title}\n${sourceItem.body ?? ""}`),
          entities: {
            models: [],
            companies: [],
            capabilities: [],
          },
          affected_functions: ["software-engineering", "product-management"],
          affected_skills: heuristicSkills(`${sourceItem.title}\n${sourceItem.body ?? ""}`),
          affected_seniority_levels: ["mid", "senior"] as const,
          significance_score: 0.45,
        },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }
  const embedding = await embedFeedText(
    `${sourceItem.title}\n\n${object.enriched_summary}\n\nEntities: ${JSON.stringify(object.entities)}`,
  )
  const itemFunctionClassification = classifyItemFunction({
    affectedFunctions: (object.affected_functions as string[] | undefined) ?? [],
    title: String(sourceItem.title),
    summary: String(object.enriched_summary ?? ""),
    affectedSkills: (object.affected_skills as string[] | undefined) ?? [],
  })

  const { data: row, error: upErr } = await supabaseAdmin
    .schema("careeros")
    .from("feed_items_enriched")
    .upsert(
      {
        source_item_id: sourceItemId,
        enriched_summary: object.enriched_summary,
        entity_type: object.entity_type,
        entities: object.entities,
        affected_functions: object.affected_functions,
        affected_skills: object.affected_skills,
        affected_seniority_levels: object.affected_seniority_levels,
        significance_score: object.significance_score,
        item_primary_function: itemFunctionClassification.primary_family,
        item_function_confidence: itemFunctionClassification.confidence,
        enrichment_embedding: formatVectorLiteral(embedding),
        model_version: llmReady ? QWEN_MODEL_VERSION : "heuristic-feed-enrich-v1",
        prompt_version: FEED_ENRICH_PROMPT_VERSION,
        schema_version: FEED_ENRICHMENT_SCHEMA_VERSION,
      },
      { onConflict: "source_item_id" },
    )
    .select("id")
    .single()
  if (upErr) throw upErr

  await supabaseAdmin.schema("careeros").from("generation_runs").insert({
    id: randomUUID(),
    user_id: null,
    artefact_table: "careeros.feed_items_enriched",
    artefact_id: row.id,
    workflow_name: "careeros/feed.enrich-item",
    provider: llmReady ? "qwen" : "other",
    model_name: QWEN_MODEL_NAME,
    model_version: llmReady ? QWEN_MODEL_VERSION : "heuristic-feed-enrich-v1",
    prompt_version: FEED_ENRICH_PROMPT_VERSION,
    schema_version: String(FEED_ENRICHMENT_SCHEMA_VERSION),
    input_data_version: "feed-source-item-v1",
    source_attribution: { source_key: sourceItem.source_key, source_item_id: sourceItem.source_item_id },
    input_hash: sourceItemId,
    output_hash: row.id,
    latency_ms: null,
    token_usage: usage,
    status: "completed",
  })

  return { enriched_item_id: row.id, significance_score: object.significance_score }
}

function parseVector(vec: unknown): number[] {
  if (Array.isArray(vec)) return vec.map((n) => Number(n))
  if (typeof vec === "string") {
    const trimmed = vec.trim().replace(/^\[/, "").replace(/\]$/, "")
    if (!trimmed) return []
    return trimmed.split(",").map((n) => Number(n))
  }
  return []
}

function cosine(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0
  let aa = 0
  let bb = 0
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    dot += x * y
    aa += x * x
    bb += y * y
  }
  if (aa === 0 || bb === 0) return 0
  return dot / (Math.sqrt(aa) * Math.sqrt(bb))
}

function normSkill(x: string): string {
  return x.trim().toLowerCase().replace(/\s+/g, "-")
}

function seniorityFromYears(y: number | null): "entry" | "junior" | "mid" | "senior" | "staff" {
  if (y == null) return "mid"
  if (y < 2) return "entry"
  if (y < 4) return "junior"
  if (y < 9) return "mid"
  if (y < 14) return "senior"
  return "staff"
}

export async function personaliseForUser(userId: string, enrichedItemId: string) {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [{ data: profile }, { data: skills }, { data: embeds }, { data: enriched }, { data: engagementRows }, { count: weeklyCount }] =
    await Promise.all([
    supabaseAdmin
      .schema("careeros")
      .from("user_profiles")
      .select("current_role_title,onet_soc_code,years_experience")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .schema("careeros")
      .from("user_skills")
      .select("canonical_skill_key")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(200),
    supabaseAdmin
      .schema("careeros")
      .from("user_skill_embeddings")
      .select("embedding")
      .eq("user_id", userId)
      .eq("embedding_version", "text-embedding-3-small-careeros-v1")
      .limit(80),
    supabaseAdmin
      .schema("careeros")
      .from("feed_items_enriched")
      .select(
        "id,source_item_id,enriched_summary,entity_type,entities,affected_functions,affected_skills,affected_seniority_levels,significance_score,enrichment_embedding",
      )
      .eq("id", enrichedItemId)
      .maybeSingle(),
    supabaseAdmin
      .schema("careeros")
      .from("user_ai_feed_items")
      .select("is_read,dismissed_at,item_payload,created_at")
      .eq("user_id", userId)
      .gte("created_at", since30)
      .limit(400),
    supabaseAdmin
      .schema("careeros")
      .from("user_ai_feed_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since7),
  ])
  if (!enriched) throw new Error(`Missing enriched item ${enrichedItemId}`)
  const { data: sourceItem } = await supabaseAdmin
    .schema("careeros")
    .from("feed_source_items")
    .select("id,source_key,title,url,published_at")
    .eq("id", String(enriched.source_item_id))
    .maybeSingle()
  if (!sourceItem) return { skipped: true as const, reason: "missing_source_item" as const }

  const userSkills = new Set((skills ?? []).map((s) => normSkill(String(s.canonical_skill_key ?? ""))).filter(Boolean))
  const affectedSkills = new Set(((enriched.affected_skills as string[] | null) ?? []).map(normSkill))
  const overlap = [...userSkills].filter((s) => affectedSkills.has(s)).length
  const overlapScore = userSkills.size > 0 ? overlap / Math.max(1, Math.min(userSkills.size, 10)) : 0

  const seniority = seniorityFromYears(
    typeof profile?.years_experience === "number" ? Number(profile.years_experience) : null,
  )
  const affectedSeniorities = new Set((enriched.affected_seniority_levels as string[] | null) ?? [])
  const seniorityMatch = affectedSeniorities.size === 0 || affectedSeniorities.has(seniority) ? 1 : 0

  const embeddingTarget = parseVector(enriched.enrichment_embedding)
  const userVectors = (embeds ?? []).map((e) => parseVector(e.embedding)).filter((v) => v.length === 1536)
  let centroid: number[] = []
  if (userVectors.length) {
    centroid = Array.from({ length: 1536 }, (_, i) => {
      let sum = 0
      for (const v of userVectors) sum += v[i] ?? 0
      return sum / userVectors.length
    })
  }
  const vectorScore = cosine(centroid, embeddingTarget)
  const significance = typeof enriched.significance_score === "number" ? enriched.significance_score : 0

  // Documented formula: 45% vector, 30% skill overlap, 15% seniority match, 10% significance.
  const relevance = Number((vectorScore * 0.45 + overlapScore * 0.3 + seniorityMatch * 0.15 + significance * 0.1).toFixed(3))
  const relevanceAdjusted =
    !isLlmConfigured() &&
    (String(enriched.entity_type) === "model_release" || String(enriched.entity_type) === "product_launch")
      ? Math.max(relevance, 0.62)
      : relevance
  const functionProfile = deriveFunctionProfile({
    currentRoleTitle: profile?.current_role_title ?? null,
    onetSocCode: profile?.onet_soc_code ?? null,
    skills: [...userSkills],
  })
  const itemFunction = classifyItemFunction({
    affectedFunctions: (enriched.affected_functions as string[] | null) ?? [],
    title: String(sourceItem.title),
    summary: String(enriched.enriched_summary ?? ""),
    affectedSkills: (enriched.affected_skills as string[] | null) ?? [],
  })
  const total30 = (engagementRows ?? []).length
  const read30 = (engagementRows ?? []).filter((row) => Boolean(row.is_read)).length
  const dismissed30 = (engagementRows ?? []).filter((row) => Boolean(row.dismissed_at)).length
  const saved30 = (engagementRows ?? []).filter((row) => {
    const payload = row.item_payload && typeof row.item_payload === "object" ? (row.item_payload as Record<string, unknown>) : {}
    return payload.saved === true
  }).length
  const engagement: EngagementSignals = {
    open_rate_30d: total30 > 0 ? Number((read30 / total30).toFixed(3)) : 0.45,
    dismiss_rate_30d: total30 > 0 ? Number((dismissed30 / total30).toFixed(3)) : 0.15,
    save_rate_30d: total30 > 0 ? Number((saved30 / total30).toFixed(3)) : 0.05,
  }
  const engagementDiagnostics = {
    lookback_days: 30,
    sample_size: total30,
    opened_count: read30,
    dismissed_count: dismissed30,
    saved_count: saved30,
    open_rate_30d: engagement.open_rate_30d,
    dismiss_rate_30d: engagement.dismiss_rate_30d,
    save_rate_30d: engagement.save_rate_30d,
  }
  const segment = resolveUserSegment(functionProfile.primary_family, seniority)
  const adaptiveScoreThreshold = adaptiveThreshold({ segment, engagement, baseThreshold: FEED_RELEVANCE_THRESHOLD })
  const policyDecision = evaluatePolicyGate({
    relevanceScore: relevanceAdjusted,
    adaptiveThreshold: adaptiveScoreThreshold,
    currentWeeklyDelivered: Number(weeklyCount ?? 0),
    functionProfile,
    itemFunction,
    significance,
    overlapScore,
  })
  if (!policyDecision.allow) {
    await supabaseAdmin.schema("careeros").from("generation_runs").insert({
      id: randomUUID(),
      user_id: userId,
      artefact_table: "careeros.user_ai_feed_items",
      artefact_id: null,
      workflow_name: "careeros/feed.personalise-for-user",
      provider: "other",
      model_name: QWEN_MODEL_NAME,
      model_version: "policy-only-filter",
      prompt_version: FEED_PERSONALISE_PROMPT_VERSION,
      schema_version: String(PERSONALISED_NOTE_SCHEMA_VERSION),
      input_data_version: "feed-enriched-v1",
      source_attribution: {
        enriched_item_id: enrichedItemId,
        source_item_id: sourceItem.id,
        user_segment: segment,
        serving_policy: policyDecision.servingPolicy,
        filter_reason_code: policyDecision.reasonCode,
        engagement: engagementDiagnostics,
        item_primary_function: itemFunction.primary_family,
        item_function_confidence: itemFunction.confidence,
        policy_threshold: policyDecision.appliedThreshold,
      },
      input_hash: `${userId}:${enrichedItemId}`,
      output_hash: `${userId}:${sourceItem.id}:filtered`,
      latency_ms: null,
      token_usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      status: "completed",
    })
    return {
      skipped: true as const,
      reason: policyDecision.reasonCode,
      relevance_score: relevanceAdjusted,
      policy_threshold: policyDecision.appliedThreshold,
      user_segment: segment,
      filter_reason_code: policyDecision.reasonCode,
      serving_policy: policyDecision.servingPolicy,
      engagement: engagementDiagnostics,
      item_function_confidence: itemFunction.confidence,
      item_primary_function: itemFunction.primary_family,
    }
  }

  const llmReady = isLlmConfigured()
  const { object, usage } = llmReady
    ? await qwenGenerateObject({
        schema: PersonalisedNoteSchema,
        systemPrompt: FEED_PERSONALISE_SYSTEM_PROMPT,
        userPrompt: `User role: ${profile?.current_role_title ?? "unknown"}\nUser seniority: ${seniority}\nUser skills: ${[...userSkills].slice(0, 30).join(", ")}\n\nItem title: ${sourceItem.title}\nItem summary: ${enriched.enriched_summary}\nAffected skills: ${((enriched.affected_skills as string[] | null) ?? []).join(", ")}\nAffected functions: ${((enriched.affected_functions as string[] | null) ?? []).join(", ")}\nAffected seniority: ${((enriched.affected_seniority_levels as string[] | null) ?? []).join(", ")}\n`,
      })
    : {
        object: {
          note: `Your work in ${String(profile?.current_role_title ?? "your role")} may be affected by this update. Skills in ${((enriched.affected_skills as string[] | null) ?? []).slice(0, 3).join(", ") || "AI tooling"} are likely to become more relevant. Track this source and test one related workflow this week.`,
          suggested_action: "Review the source update and run a small pilot tied to one affected skill.",
        },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }

  const note = object.suggested_action
    ? `${object.note}\n\nSuggested action: ${object.suggested_action}`
    : object.note

  const { error: insErr } = await supabaseAdmin
    .schema("careeros")
    .from("user_ai_feed_items")
    .upsert(
      {
        user_id: userId,
        feed_type: String(enriched.entity_type),
        feed_at: sourceItem.published_at,
        title: String(sourceItem.title),
        item_payload: {
          source_key: sourceItem.source_key,
          source_url: sourceItem.url,
          summary: enriched.enriched_summary,
          entities: enriched.entities,
          affected_skills: enriched.affected_skills,
          serving_policy: policyDecision.servingPolicy,
          policy_reason_code: policyDecision.reasonCode,
          threshold_used: policyDecision.appliedThreshold,
          engagement: engagementDiagnostics,
          user_segment: segment,
          role_family: functionProfile.primary_family,
          item_function_family: itemFunction.primary_family,
          item_function_confidence: itemFunction.confidence,
          policy_version: "feed-policy-v2",
        },
        enriched_item_id: enrichedItemId,
        relevance_score: relevanceAdjusted,
        personalised_note: note,
        model_version: llmReady ? QWEN_MODEL_VERSION : "heuristic-feed-personalise-v1",
        prompt_version: FEED_PERSONALISE_PROMPT_VERSION,
        schema_version: String(PERSONALISED_NOTE_SCHEMA_VERSION),
        input_data_version: "feed-enriched-v1",
        source_attribution: {
          source_key: sourceItem.source_key,
          source_url: sourceItem.url,
          user_segment: segment,
          serving_policy: policyDecision.servingPolicy,
          filter_reason_code: policyDecision.reasonCode,
        },
        serving_policy: {
          policy_version: "feed-policy-v2",
          serving_mode: policyDecision.servingPolicy,
          reason_code: policyDecision.reasonCode,
          adaptive_threshold: policyDecision.appliedThreshold,
          base_threshold: FEED_RELEVANCE_THRESHOLD,
          weekly_count_before_insert: Number(weeklyCount ?? 0),
          floor_target: 3,
          weekly_cap: 5,
          segment,
          role_family: functionProfile.primary_family,
          item_function_family: itemFunction.primary_family,
          item_function_confidence: itemFunction.confidence,
          below_floor_before_insert: policyDecision.belowFloor,
          engagement: engagementDiagnostics,
        },
      },
      { onConflict: "user_id,title,feed_at" },
    )
  if (insErr) throw insErr

  await supabaseAdmin.schema("careeros").from("generation_runs").insert({
    id: randomUUID(),
    user_id: userId,
    artefact_table: "careeros.user_ai_feed_items",
    artefact_id: null,
    workflow_name: "careeros/feed.personalise-for-user",
    provider: llmReady ? "qwen" : "other",
    model_name: QWEN_MODEL_NAME,
    model_version: llmReady ? QWEN_MODEL_VERSION : "heuristic-feed-personalise-v1",
    prompt_version: FEED_PERSONALISE_PROMPT_VERSION,
    schema_version: String(PERSONALISED_NOTE_SCHEMA_VERSION),
    input_data_version: "feed-enriched-v1",
    source_attribution: {
      enriched_item_id: enrichedItemId,
      source_item_id: sourceItem.id,
      user_segment: segment,
      serving_policy: policyDecision.servingPolicy,
      filter_reason_code: policyDecision.reasonCode,
      engagement: engagementDiagnostics,
      item_primary_function: itemFunction.primary_family,
      item_function_confidence: itemFunction.confidence,
      policy_threshold: policyDecision.appliedThreshold,
    },
    input_hash: `${userId}:${enrichedItemId}`,
    output_hash: `${userId}:${sourceItem.id}`,
    latency_ms: null,
    token_usage: usage,
    status: "completed",
  })

  return {
    skipped: false as const,
    relevance_score: relevanceAdjusted,
    serving_policy: policyDecision.servingPolicy,
    policy_threshold: policyDecision.appliedThreshold,
    user_segment: segment,
    engagement: engagementDiagnostics,
    item_primary_function: itemFunction.primary_family,
    item_function_confidence: itemFunction.confidence,
  }
}

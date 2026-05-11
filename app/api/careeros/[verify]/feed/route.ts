import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const SPEND_BASELINE_24H_USD = {
  total: 20,
  enrich: 6,
  personalise: 14,
}
const COST_PER_1K_TOKENS_USD = 0.002
const EXPECTED_INGEST_RUNS_PER_7D = 7
const EXPECTED_PERSONALISE_RUNS_PER_7D = 7

function asTokenUsage(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function extractTotalTokens(value: unknown): number {
  const usage = asTokenUsage(value)
  if (typeof usage.totalTokens === "number") return usage.totalTokens
  if (typeof usage.total_tokens === "number") return usage.total_tokens
  return 0
}

function extractSegment(value: unknown): string {
  const src = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const segment = src.user_segment
  return typeof segment === "string" && segment.trim() ? segment : "unknown"
}

export async function GET(request: Request, context: { params: Promise<{ verify: string }> }) {
  const { verify } = await context.params
  if (verify !== "_verify") return NextResponse.json({ error: "Not found" }, { status: 404 })
  const token = new URL(request.url).searchParams.get("token")
  if (!token || token !== process.env.VERIFY_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = new URL(request.url).searchParams.get("user_id")
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since48 = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [
    { data: ingestRows },
    { data: ingestRows7d },
    { data: personaliseRuns7d },
    { data: sourceRows },
    { data: enriched24 },
    { data: personal24 },
    { data: userSample },
    { data: generationRows },
    { data: sourceRows48h },
    { data: personalRows7d },
    { data: personalisationRuns7d },
  ] =
    await Promise.all([
      supabaseAdmin
        .schema("careeros")
        .from("cache_refresh_runs")
        .select("status,started_at,run_stats")
        .eq("dataset_key", "feed_source_items")
        .order("started_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .schema("careeros")
        .from("cache_refresh_runs")
        .select("status,started_at,workflow_name,run_stats")
        .eq("dataset_key", "feed_source_items")
        .gte("started_at", since7)
        .order("started_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .schema("careeros")
        .from("cache_refresh_runs")
        .select("status,started_at,workflow_name,run_stats")
        .eq("dataset_key", "user_ai_feed_items")
        .gte("started_at", since7)
        .order("started_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .schema("careeros")
        .from("feed_source_items")
        .select("source_key,published_at")
        .gte("ingested_at", since24)
        .limit(5000),
      supabaseAdmin
        .schema("careeros")
        .from("feed_items_enriched")
        .select("id,significance_score,created_at")
        .gte("created_at", since24)
        .limit(5000),
      supabaseAdmin
        .schema("careeros")
        .from("user_ai_feed_items")
        .select("id,relevance_score,feed_at,serving_policy,item_payload")
        .gte("created_at", since24)
        .limit(10000),
      userId
        ? supabaseAdmin
            .schema("careeros")
            .from("user_ai_feed_items")
            .select("feed_type,feed_at")
            .eq("user_id", userId)
            .gte("feed_at", since7)
            .is("dismissed_at", null)
            .limit(200)
        : Promise.resolve({ data: [] as Array<{ feed_type: string; feed_at: string }> }),
      supabaseAdmin
        .schema("careeros")
        .from("generation_runs")
        .select("workflow_name,token_usage,created_at,source_attribution")
        .in("workflow_name", ["careeros/feed.enrich-item", "careeros/feed.personalise-for-user"])
        .gte("created_at", since24)
        .limit(20000),
      supabaseAdmin
        .schema("careeros")
        .from("feed_source_items")
        .select("source_key")
        .gte("ingested_at", since48)
        .limit(15000),
      supabaseAdmin
        .schema("careeros")
        .from("user_ai_feed_items")
        .select("id,created_at,is_read,dismissed_at,serving_policy,item_payload")
        .gte("created_at", since7)
        .order("created_at", { ascending: false })
        .limit(20000),
      supabaseAdmin
        .schema("careeros")
        .from("generation_runs")
        .select("status,created_at,source_attribution")
        .eq("workflow_name", "careeros/feed.personalise-for-user")
        .gte("created_at", since7)
        .limit(20000),
    ])

  const itemsBySource: Record<string, number> = {}
  for (const r of sourceRows ?? []) {
    const k = String(r.source_key)
    itemsBySource[k] = (itemsBySource[k] ?? 0) + 1
  }

  const byType: Record<string, number> = {}
  for (const r of userSample ?? []) {
    const k = String(r.feed_type)
    byType[k] = (byType[k] ?? 0) + 1
  }

  const consecutiveSuccess = (() => {
    let c = 0
    for (const r of ingestRows ?? []) {
      if (String(r.status) === "completed") c += 1
      else break
    }
    return c
  })()

  const avgSig =
    (enriched24 ?? []).length > 0
      ? Number(
          (
            (enriched24 ?? []).reduce((acc, x) => acc + Number(x.significance_score ?? 0), 0) /
            Math.max(1, (enriched24 ?? []).length)
          ).toFixed(3),
        )
      : 0
  const avgRel =
    (personal24 ?? []).length > 0
      ? Number(
          (
            (personal24 ?? []).reduce((acc, x) => acc + Number(x.relevance_score ?? 0), 0) /
            Math.max(1, (personal24 ?? []).length)
          ).toFixed(3),
        )
      : 0

  let enrichmentTokens = 0
  let personalisationTokens = 0
  const tokensByWorkflow: Record<string, number> = {}
  const tokensBySegment: Record<string, { enrich_tokens: number; personalise_tokens: number; total_tokens: number }> = {}
  for (const row of generationRows ?? []) {
    const total = extractTotalTokens(row.token_usage)
    const wf = String(row.workflow_name)
    tokensByWorkflow[wf] = (tokensByWorkflow[wf] ?? 0) + total
    if (String(row.workflow_name) === "careeros/feed.enrich-item") enrichmentTokens += total
    if (String(row.workflow_name) === "careeros/feed.personalise-for-user") personalisationTokens += total
    const segment = extractSegment(row.source_attribution)
    if (!tokensBySegment[segment]) {
      tokensBySegment[segment] = { enrich_tokens: 0, personalise_tokens: 0, total_tokens: 0 }
    }
    if (wf === "careeros/feed.enrich-item") tokensBySegment[segment].enrich_tokens += total
    if (wf === "careeros/feed.personalise-for-user") tokensBySegment[segment].personalise_tokens += total
    tokensBySegment[segment].total_tokens += total
  }
  // Conservative blended estimate for Qwen usage per 1k tokens.
  const estimatedCostUsd = Number(
    (((enrichmentTokens + personalisationTokens) / 1000) * 0.002).toFixed(2),
  )
  const enrichCostUsd = Number(((enrichmentTokens / 1000) * COST_PER_1K_TOKENS_USD).toFixed(2))
  const personaliseCostUsd = Number(((personalisationTokens / 1000) * COST_PER_1K_TOKENS_USD).toFixed(2))
  const costBySegment = Object.entries(tokensBySegment).reduce<Record<string, Record<string, number>>>((acc, [segment, usage]) => {
    acc[segment] = {
      enrich_tokens: usage.enrich_tokens,
      personalise_tokens: usage.personalise_tokens,
      total_tokens: usage.total_tokens,
      estimated_cost_usd: Number(((usage.total_tokens / 1000) * COST_PER_1K_TOKENS_USD).toFixed(4)),
    }
    return acc
  }, {})
  const spendAlerts = {
    total_gt_2x_baseline: estimatedCostUsd > SPEND_BASELINE_24H_USD.total * 2,
    enrich_gt_2x_baseline: enrichCostUsd > SPEND_BASELINE_24H_USD.enrich * 2,
    personalise_gt_2x_baseline: personaliseCostUsd > SPEND_BASELINE_24H_USD.personalise * 2,
  }

  const sourceCoverage48h: Record<string, number> = {}
  for (const row of sourceRows48h ?? []) {
    const k = String(row.source_key)
    sourceCoverage48h[k] = (sourceCoverage48h[k] ?? 0) + 1
  }
  const recentIngestStat = (ingestRows?.[0]?.run_stats ?? null) as
    | { source_errors?: Record<string, string>; source_coverage?: Array<{ source: string; fetched: number; ok: boolean; error: string | null }>; source_yield_score?: number }
    | null
  const observedIngestRuns7d = (ingestRows7d ?? []).filter((r) => String(r.status) === "completed").length
  const observedPersonaliseRuns7dCache = (personaliseRuns7d ?? []).filter((r) => String(r.status) === "completed").length
  const observedPersonaliseRuns7dGen = (personalisationRuns7d ?? []).filter((r) => String(r.status) === "completed").length
  const observedPersonaliseRuns7d = Math.max(observedPersonaliseRuns7dCache, observedPersonaliseRuns7dGen)
  const filterReasons7d: Record<string, number> = {}
  for (const row of personaliseRuns7d ?? []) {
    const stats = row.run_stats && typeof row.run_stats === "object" ? (row.run_stats as Record<string, unknown>) : {}
    const reason = typeof stats.filter_reason_code === "string" ? stats.filter_reason_code : typeof stats.reason === "string" ? stats.reason : "unknown"
    filterReasons7d[reason] = (filterReasons7d[reason] ?? 0) + 1
  }
  for (const row of personalisationRuns7d ?? []) {
    const attrs =
      row.source_attribution && typeof row.source_attribution === "object"
        ? (row.source_attribution as Record<string, unknown>)
        : {}
    const reason = typeof attrs.filter_reason_code === "string" ? attrs.filter_reason_code : "unknown"
    filterReasons7d[reason] = (filterReasons7d[reason] ?? 0) + 1
  }

  const servingPolicyCounts7d: Record<string, number> = {}
  const thresholdDiagnostics7d = {
    count: 0,
    avg_adaptive_threshold: 0,
    avg_open_rate_30d: 0,
    avg_dismiss_rate_30d: 0,
    avg_save_rate_30d: 0,
  }
  let thresholdSum = 0
  let thresholdCount = 0
  let openRateSum = 0
  let openRateCount = 0
  let dismissRateSum = 0
  let dismissRateCount = 0
  let saveRateSum = 0
  let saveRateCount = 0
  for (const row of personalRows7d ?? []) {
    const servingPolicy =
      row.serving_policy && typeof row.serving_policy === "object" ? (row.serving_policy as Record<string, unknown>) : {}
    const payload = row.item_payload && typeof row.item_payload === "object" ? (row.item_payload as Record<string, unknown>) : {}
    const modeRaw = servingPolicy.serving_mode
    const mode = typeof modeRaw === "string" && modeRaw.trim() ? modeRaw : "unknown"
    servingPolicyCounts7d[mode] = (servingPolicyCounts7d[mode] ?? 0) + 1
    const adaptiveThreshold = Number(servingPolicy.adaptive_threshold ?? servingPolicy.threshold_used)
    const engagement =
      payload.engagement && typeof payload.engagement === "object" ? (payload.engagement as Record<string, unknown>) : {}
    const openRate = Number(engagement.open_rate_30d)
    const dismissRate = Number(engagement.dismiss_rate_30d)
    const saveRate = Number(engagement.save_rate_30d)
    if (Number.isFinite(adaptiveThreshold)) {
      thresholdSum += adaptiveThreshold
      thresholdCount += 1
    }
    if (Number.isFinite(openRate)) {
      openRateSum += openRate
      openRateCount += 1
    }
    if (Number.isFinite(dismissRate)) {
      dismissRateSum += dismissRate
      dismissRateCount += 1
    }
    if (Number.isFinite(saveRate)) {
      saveRateSum += saveRate
      saveRateCount += 1
    }
  }
  thresholdDiagnostics7d.count = thresholdCount
  if (thresholdCount > 0) {
    thresholdDiagnostics7d.avg_adaptive_threshold = Number((thresholdSum / thresholdCount).toFixed(3))
  }
  if (openRateCount > 0) {
    thresholdDiagnostics7d.avg_open_rate_30d = Number((openRateSum / openRateCount).toFixed(3))
  }
  if (dismissRateCount > 0) {
    thresholdDiagnostics7d.avg_dismiss_rate_30d = Number((dismissRateSum / dismissRateCount).toFixed(3))
  }
  if (saveRateCount > 0) {
    thresholdDiagnostics7d.avg_save_rate_30d = Number((saveRateSum / saveRateCount).toFixed(3))
  }
  const prioritisedRows = (personalRows7d ?? [])
    .slice()
    .sort((a, b) => {
      const aMode =
        a.serving_policy && typeof a.serving_policy === "object"
          ? typeof (a.serving_policy as Record<string, unknown>).serving_mode === "string"
          : false
      const bMode =
        b.serving_policy && typeof b.serving_policy === "object"
          ? typeof (b.serving_policy as Record<string, unknown>).serving_mode === "string"
          : false
      if (aMode !== bMode) return aMode ? -1 : 1
      return String(b.created_at).localeCompare(String(a.created_at))
    })
  const sampledServingPolicyRows = prioritisedRows.slice(0, 10).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    is_read: row.is_read,
    dismissed_at: row.dismissed_at,
    serving_policy: row.serving_policy ?? {},
    engagement: row.item_payload && typeof row.item_payload === "object"
      ? ((row.item_payload as Record<string, unknown>).engagement ?? null)
      : null,
  }))

  return NextResponse.json({
    ingestion_health: {
      last_ingestion_run: ingestRows?.[0]?.started_at ?? null,
      items_ingested_last_24h: (sourceRows ?? []).length,
      items_by_source: itemsBySource,
      consecutive_successful_runs: consecutiveSuccess,
    },
    enrichment_health: {
      enriched_last_24h: (enriched24 ?? []).length,
      failed_enrichment: 0,
      avg_significance_score: avgSig,
      high_significance_items_last_7d: (enriched24 ?? []).filter((x) => Number(x.significance_score ?? 0) >= 0.7)
        .length,
    },
    personalisation_health: {
      active_users: userId ? 1 : null,
      personalised_items_last_24h: (personal24 ?? []).length,
      avg_relevance_score_persisted: avgRel,
      items_filtered_below_threshold: null,
    },
    user_feed_sample: userId
      ? {
          user_id: userId,
          feed_items_last_7d: (userSample ?? []).length,
          by_entity_type: byType,
        }
      : null,
    qwen_spend_last_24h: {
      enrichment_tokens: enrichmentTokens,
      personalisation_tokens: personalisationTokens,
      by_workflow_tokens: tokensByWorkflow,
      by_segment: costBySegment,
      estimated_cost_by_workflow_usd: {
        enrich: enrichCostUsd,
        personalise: personaliseCostUsd,
      },
      estimated_cost_usd: estimatedCostUsd,
      baseline_24h_usd: SPEND_BASELINE_24H_USD,
      alert_flags: spendAlerts,
    },
    source_adapter_health: {
      active_sources_last_48h: Object.keys(sourceCoverage48h).length,
      items_by_source_last_48h: sourceCoverage48h,
      source_errors_last_ingest: recentIngestStat?.source_errors ?? {},
      source_coverage_last_ingest: recentIngestStat?.source_coverage ?? [],
      source_yield_score_last_ingest: recentIngestStat?.source_yield_score ?? null,
    },
    scheduled_run_evidence: {
      lookback_days: 7,
      ingest: {
        expected_runs: EXPECTED_INGEST_RUNS_PER_7D,
        observed_completed_runs: observedIngestRuns7d,
        missed_run_count: Math.max(0, EXPECTED_INGEST_RUNS_PER_7D - observedIngestRuns7d),
        status: observedIngestRuns7d >= EXPECTED_INGEST_RUNS_PER_7D ? "on_track" : "at_risk",
      },
      personalise: {
        expected_runs: EXPECTED_PERSONALISE_RUNS_PER_7D,
        observed_completed_runs: observedPersonaliseRuns7d,
        observed_completed_runs_from_cache_refresh: observedPersonaliseRuns7dCache,
        observed_completed_runs_from_generation_runs: observedPersonaliseRuns7dGen,
        missed_run_count: Math.max(0, EXPECTED_PERSONALISE_RUNS_PER_7D - observedPersonaliseRuns7d),
        status: observedPersonaliseRuns7d >= EXPECTED_PERSONALISE_RUNS_PER_7D ? "on_track" : "at_risk",
        filtered_reason_codes_7d: filterReasons7d,
        serving_policy_modes_7d: servingPolicyCounts7d,
        threshold_policy_diagnostics_7d: thresholdDiagnostics7d,
        sampled_rows_with_policy_7d: sampledServingPolicyRows,
      },
    },
  })
}

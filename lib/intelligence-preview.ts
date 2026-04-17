import { supabaseAdmin } from "@/lib/supabase"
import { coerceBehavioralSummary, type RedditBehavioralSummary } from "@/lib/juno/reddit-recon"
import { toLegacyFeedRow, type AiOutputDbRow, type LegacyAiFeedRow } from "@/lib/ai-outputs-legacy"

export interface IntelligencePreviewShareRow {
  id: string
  slug: string
  userId: string
  organizationId: string | null
  workspaceId: string | null
  label: string
  showSignalFeed: boolean
  showSecurityAlerts: boolean
  showBehavioral: boolean
  showIntentSignals: boolean
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface IntelligencePreviewPayload {
  label: string
  companyName: string | null
  updatedAt: string | null
  features: {
    signalFeed: boolean
    securityAlerts: boolean
    behavioral: boolean
    intentSignals: boolean
  }
  brief: LegacyAiFeedRow | null
  behavioralUpdates: {
    id: string
    created_at: string
    summary: RedditBehavioralSummary
    conversationCount: number
    subreddits: string[]
    latestSignalAt: string | null
  } | null
  hotIntentCount: number
  securityCounts: {
    critical: number
    high: number
    medium: number
    low: number
    total: number
  } | null
}

const OUT_FIELDS = "id, tool, title, inputs, output, metadata, created_at"

function mapShareRow(row: Record<string, unknown>): IntelligencePreviewShareRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    userId: String(row.user_id),
    organizationId: (row.organization_id as string | null) ?? null,
    workspaceId: (row.workspace_id as string | null) ?? null,
    label: String(row.label ?? ""),
    showSignalFeed: row.show_signal_feed !== false,
    showSecurityAlerts: row.show_security_alerts !== false,
    showBehavioral: row.show_behavioral !== false,
    showIntentSignals: row.show_intent_signals !== false,
    isActive: row.is_active !== false,
    expiresAt: (row.expires_at as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  }
}

export function normalizePreviewSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export function isValidPreviewSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 60 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

export async function getIntelligencePreviewShareBySlug(
  rawSlug: string,
): Promise<IntelligencePreviewShareRow | null> {
  const slug = rawSlug.trim().toLowerCase()
  if (!slug) return null

  const { data, error } = await supabaseAdmin
    .from("intelligence_preview_shares")
    .select("*")
    .eq("slug", slug)
    .maybeSingle()

  if (error && error.code !== "PGRST116") {
    console.error("[intelligence-preview] lookup error:", error.message)
    return null
  }
  if (!data) return null

  const row = mapShareRow(data as Record<string, unknown>)
  if (!row.isActive) return null
  if (row.expiresAt && Date.parse(row.expiresAt) < Date.now()) return null
  return row
}

export async function listIntelligencePreviewShares(
  createdBy: string,
): Promise<IntelligencePreviewShareRow[]> {
  const { data, error } = await supabaseAdmin
    .from("intelligence_preview_shares")
    .select("*")
    .eq("created_by", createdBy)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[intelligence-preview] list error:", error.message)
    return []
  }
  return (data ?? []).map((row) => mapShareRow(row as Record<string, unknown>))
}

export interface CreateIntelligencePreviewShareInput {
  slug: string
  userId: string
  label: string
  organizationId?: string | null
  workspaceId?: string | null
  createdBy: string
  showSignalFeed?: boolean
  showSecurityAlerts?: boolean
  showBehavioral?: boolean
  showIntentSignals?: boolean
  expiresAt?: string | null
}

export async function createIntelligencePreviewShare(
  input: CreateIntelligencePreviewShareInput,
): Promise<{ share: IntelligencePreviewShareRow } | { error: string }> {
  const slug = normalizePreviewSlug(input.slug)
  if (!isValidPreviewSlug(slug)) {
    return { error: "Slug must be 3-60 chars, lowercase letters/numbers with optional single hyphens." }
  }

  const { data: existing } = await supabaseAdmin
    .from("intelligence_preview_shares")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()
  if (existing) return { error: `Slug "${slug}" is already in use.` }

  const { data, error } = await supabaseAdmin
    .from("intelligence_preview_shares")
    .insert({
      slug,
      user_id: input.userId,
      organization_id: input.organizationId ?? null,
      workspace_id: input.workspaceId ?? null,
      label: input.label.trim() || slug,
      show_signal_feed: input.showSignalFeed ?? true,
      show_security_alerts: input.showSecurityAlerts ?? true,
      show_behavioral: input.showBehavioral ?? true,
      show_intent_signals: input.showIntentSignals ?? true,
      expires_at: input.expiresAt ?? null,
      created_by: input.createdBy,
    })
    .select("*")
    .single()

  if (error || !data) {
    return { error: error?.message ?? "Failed to create preview share." }
  }

  return { share: mapShareRow(data as Record<string, unknown>) }
}

export async function deactivateIntelligencePreviewShare(
  id: string,
  createdBy: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabaseAdmin
    .from("intelligence_preview_shares")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("created_by", createdBy)
  if (error) return { error: error.message }
  return { ok: true }
}

async function fetchSecurityCounts(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("security_findings")
    .select("severity, status")
    .eq("user_id", userId)
    .eq("status", "open")

  if (error) {
    const msg = (error.message ?? "").toLowerCase()
    if (msg.includes("does not exist") || msg.includes("schema cache")) return null
    return null
  }

  const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
  for (const row of (data ?? []) as Array<{ severity: string | null }>) {
    const sev = (row.severity ?? "").toLowerCase()
    if (sev === "critical") counts.critical += 1
    else if (sev === "high") counts.high += 1
    else if (sev === "medium") counts.medium += 1
    else if (sev === "low") counts.low += 1
    counts.total += 1
  }
  return counts
}

async function fetchCompanyName(userId: string, organizationId: string | null) {
  const query = supabaseAdmin
    .from("company_profile")
    .select("company_name")
    .limit(1)

  const { data } = organizationId
    ? await query.eq("organization_id", organizationId).maybeSingle()
    : await query.eq("user_id", userId).maybeSingle()

  const name = (data as { company_name?: string | null } | null)?.company_name
  return typeof name === "string" && name.trim() ? name.trim() : null
}

export async function buildIntelligencePreviewPayload(
  share: IntelligencePreviewShareRow,
): Promise<IntelligencePreviewPayload> {
  const userId = share.userId

  const briefPromise = share.showSignalFeed
    ? supabaseAdmin
        .from("ai_outputs")
        .select(OUT_FIELDS)
        .eq("user_id", userId)
        .in("tool", ["daily_brief", "competitor-snapshot"])
        .order("created_at", { ascending: false })
        .limit(1)
    : Promise.resolve({ data: null })

  const behavioralPromise = share.showBehavioral
    ? supabaseAdmin
        .from("ai_outputs")
        .select(OUT_FIELDS)
        .eq("user_id", userId)
        .eq("tool", "behavioral_updates")
        .order("created_at", { ascending: false })
        .limit(1)
    : Promise.resolve({ data: null })

  const hotIntentPromise = share.showIntentSignals
    ? supabaseAdmin
        .from("intent_signals")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("platform", "reddit")
        .eq("status", "new")
        .gte("relevance_score", 8)
    : Promise.resolve({ count: 0 })

  const securityPromise = share.showSecurityAlerts
    ? fetchSecurityCounts(userId)
    : Promise.resolve(null)

  const companyPromise = fetchCompanyName(userId, share.organizationId)

  const [briefRes, behavioralRes, hotIntentRes, securityCounts, companyName] = await Promise.all([
    briefPromise,
    behavioralPromise,
    hotIntentPromise,
    securityPromise,
    companyPromise,
  ])

  const briefRows = (briefRes as { data: AiOutputDbRow[] | null }).data ?? []
  const behavioralRows = (behavioralRes as { data: AiOutputDbRow[] | null }).data ?? []

  const brief = briefRows[0] ? toLegacyFeedRow(briefRows[0]) : null

  const behavioralInputs = (behavioralRows[0]?.inputs ?? {}) as Record<string, unknown>
  const behavioralSummary = coerceBehavioralSummary(behavioralInputs.summary)
  const behavioralUpdates =
    behavioralRows[0] && behavioralSummary
      ? {
          id: behavioralRows[0].id,
          created_at: behavioralRows[0].created_at,
          summary: behavioralSummary,
          conversationCount:
            typeof behavioralInputs.conversationCount === "number"
              ? behavioralInputs.conversationCount
              : Number(behavioralInputs.conversationCount ?? 0) || 0,
          subreddits: Array.isArray(behavioralInputs.subreddits)
            ? behavioralInputs.subreddits.filter(
                (v): v is string => typeof v === "string" && v.trim().length > 0,
              )
            : [],
          latestSignalAt:
            typeof behavioralInputs.latestSignalAt === "string"
              ? behavioralInputs.latestSignalAt
              : null,
        }
      : null

  return {
    label: share.label,
    companyName,
    updatedAt: brief?.created_at ?? behavioralUpdates?.created_at ?? null,
    features: {
      signalFeed: share.showSignalFeed,
      securityAlerts: share.showSecurityAlerts,
      behavioral: share.showBehavioral,
      intentSignals: share.showIntentSignals,
    },
    brief,
    behavioralUpdates,
    hotIntentCount: (hotIntentRes as { count?: number | null }).count ?? 0,
    securityCounts,
  }
}

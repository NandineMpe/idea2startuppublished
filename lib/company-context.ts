/**
 * Company Context Engine - the BRAIN.
 * Every agent calls getCompanyContext() before scrapers or model calls.
 *
 * Layers (in order):
 *   1. Structured profile (company_profile)
 *   2. Uploaded docs + scraped assets
 *   3. Primary markdown knowledge base (company_profile.knowledge_base_md)
 *   4. Cached Obsidian vault digest (company_profile.vault_context_cache)
 *
 * Output: structured CompanyContext + promptBlock for system prompts.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveOrganizationSelection } from "@/lib/organizations"
import { resolveWorkspaceSelection } from "@/lib/workspaces"

export interface CompanyContext {
  userId: string
  scope?: "owner" | "workspace"
  organizationId?: string | null
  organizationSlug?: string | null
  organizationDisplayName?: string | null
  workspaceId?: string | null
  workspaceSlug?: string | null
  workspaceDisplayName?: string | null
  profile: CompanyProfile
  assets: CompanyAsset[]
  /** Deprecated live GitHub reads; preserved as an empty array for compatibility. */
  vaultFiles: Array<{ path: string; content: string }>
  /** Deprecated live vault search hits; preserved as an empty array for compatibility. */
  knowledgeHits: string[]
  /** Pre-formatted block for LLM system prompts (Qwen in production) */
  promptBlock: string
  extracted: {
    competitors: string[]
    keywords: string[]
    icp: string[]
    vertical: string
    stage: string
  }
}

export type BrandChannelVoice = {
  linkedin: string
  cold_email: string
  reddit_hn: string
}

export interface CompanyProfile {
  id: string
  user_id: string
  name: string
  description: string
  problem: string
  solution: string
  market: string
  industry: string
  vertical: string
  stage: string
  business_model: string
  founder_name: string
  founder_background: string
  founder_location: string
  thesis: string
  icp: string[]
  competitors: string[]
  keywords: string[]
  differentiators: string
  traction: string
  brand_voice_dna: string
  brand_promise: string
  brand_channel_voice: BrandChannelVoice
  brand_words_use: string[]
  brand_words_never: string[]
  brand_credibility_hooks: string[]
  brand_voice: string
  brand_never_say: string
  brand_proof_points: string
  knowledge_base_md: string
  knowledge_base_updated_at: string | null
  github_vault_repo: string
  github_vault_branch: string
  vault_folders: string[]
  vault_context_cache: string
  vault_context_last_synced_at: string | null
  vault_context_file_count: number
  vault_context_sync_error: string | null
  whatsapp_number?: string | null
  whatsapp_verified?: boolean | null
  /** Lowercase subreddit names for Reddit intent scans; null means derive each run from context plus defaults. */
  reddit_intent_subreddits: string[] | null
  raw: Record<string, unknown>
}

/** Normalize profile/API JSON into lowercase subreddit slugs, or null if empty. */
export function parseRedditIntentSubreddits(value: unknown): string[] | null {
  if (value == null) return null
  if (!Array.isArray(value)) return null
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const s = item.trim().replace(/^r\//i, "")
    if (/^[A-Za-z0-9_]{2,32}$/.test(s)) out.push(s.toLowerCase())
  }
  const uniq = [...new Set(out)]
  return uniq.length > 0 ? uniq.slice(0, 16) : null
}

export type CompanyAssetType = "pitch_deck" | "document" | "scrape" | "other"

export interface CompanyAsset {
  id: string
  type: CompanyAssetType
  name: string
  content: string
  created_at: string
  source_url?: string | null
}

export type VaultRefreshMode = "never" | "if_stale" | "always"

export interface GetCompanyContextOptions {
  queryHint?: string
  maxAssets?: number
  maxAssetChars?: number
  workspaceId?: string | null
  useCookieWorkspace?: boolean
  organizationId?: string | null
  useCookieOrganization?: boolean
  refreshVault?: VaultRefreshMode
  vaultMaxStaleMs?: number
}

async function getSupabaseForContext(): Promise<SupabaseClient> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { supabaseAdmin } = await import("@/lib/supabase")
    return supabaseAdmin
  }
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

const DEFAULT_VAULT_MAX_STALE_MS = 1000 * 60 * 15

function shouldRefreshVaultContext(
  profile: CompanyProfile,
  options: GetCompanyContextOptions,
  scope: CompanyContext["scope"],
): boolean {
  if (scope !== "owner") return false
  if (!profile.github_vault_repo.trim()) return false

  const mode = options.refreshVault ?? "never"
  if (mode === "never") return false
  if (mode === "always") return true

  if (!profile.vault_context_cache.trim()) return true

  const lastSynced = profile.vault_context_last_synced_at
    ? new Date(profile.vault_context_last_synced_at).getTime()
    : Number.NaN

  if (!Number.isFinite(lastSynced)) return true
  return Date.now() - lastSynced > (options.vaultMaxStaleMs ?? DEFAULT_VAULT_MAX_STALE_MS)
}

async function maybeRefreshVaultContext(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string | undefined,
  profile: CompanyProfile,
  options: GetCompanyContextOptions,
  scope: CompanyContext["scope"],
): Promise<CompanyProfile> {
  if (!shouldRefreshVaultContext(profile, options, scope)) return profile

  try {
    const { syncVaultContextCacheForUser } = await import("@/lib/vault-context-sync")
    const result = await syncVaultContextCacheForUser(supabase, userId, organizationId)

    if (!result.connected) return profile
    if (!result.ok) {
      return {
        ...profile,
        vault_context_sync_error: result.error ?? profile.vault_context_sync_error,
      }
    }

    return {
      ...profile,
      vault_context_cache: result.cache,
      vault_context_last_synced_at: result.lastSyncedAt,
      vault_context_file_count: result.fileCount,
      vault_context_sync_error: result.warning ?? null,
      vault_folders: result.folders,
    }
  } catch (e) {
    console.error("[company-context] vault refresh failed:", e)
    return profile
  }
}

export async function getCompanyContext(
  userId: string | undefined,
  options: GetCompanyContextOptions = {},
): Promise<CompanyContext | null> {
  if (!userId) return null

  const { maxAssets = 5, maxAssetChars = 3000 } = options
  void options.queryHint

  try {
    const supabase = await getSupabaseForContext()
    const workspace = await resolveWorkspaceSelection(userId, {
      workspaceId: options.workspaceId,
      useCookieWorkspace: options.useCookieWorkspace,
    })
    const organization =
      workspace === null
        ? await resolveOrganizationSelection(userId, {
            organizationId: options.organizationId,
            useCookieOrganization: options.useCookieOrganization,
          })
        : null

    let profile = workspace
      ? await loadWorkspaceProfile(supabase, userId, workspace.id)
      : await loadProfile(supabase, organization?.id)
    const assets = workspace
      ? await loadWorkspaceAssets(supabase, userId, workspace.id, maxAssets, maxAssetChars)
      : await loadAssets(supabase, organization?.id, maxAssets, maxAssetChars)
    profile = await maybeRefreshVaultContext(
      supabase,
      userId,
      organization?.id,
      profile,
      options,
      workspace ? "workspace" : "owner",
    )
    const extracted = extractIntelligence(profile)

    return {
      userId,
      scope: workspace ? "workspace" : "owner",
      organizationId: organization?.id ?? null,
      organizationSlug: organization?.slug ?? null,
      organizationDisplayName: organization?.displayName ?? null,
      workspaceId: workspace?.id ?? null,
      workspaceSlug: workspace?.slug ?? null,
      workspaceDisplayName: workspace?.displayName ?? null,
      profile,
      assets,
      vaultFiles: [],
      knowledgeHits: [],
      promptBlock: buildPromptBlock(profile, assets),
      extracted,
    }
  } catch (e) {
    console.error("getCompanyContext error:", e)
    return null
  }
}

export async function getCompanyContextPrompt(
  userId: string | undefined,
  options: GetCompanyContextOptions = {},
): Promise<string> {
  const ctx = await getCompanyContext(userId, options)
  return ctx?.promptBlock ?? ""
}

export async function getCompanyContextLight(
  userId: string,
  options: Pick<GetCompanyContextOptions, "workspaceId" | "useCookieWorkspace"> = {},
): Promise<{ profile: CompanyProfile; extracted: CompanyContext["extracted"] } | null> {
  try {
    const supabase = await getSupabaseForContext()
    const workspace = await resolveWorkspaceSelection(userId, {
      workspaceId: options.workspaceId,
      useCookieWorkspace: options.useCookieWorkspace,
    })
    const profile = workspace
      ? await loadWorkspaceProfile(supabase, userId, workspace.id)
      : await loadProfile(supabase, userId)
    const extracted = extractIntelligence(profile)
    return { profile, extracted }
  } catch (e) {
    console.error("getCompanyContextLight error:", e)
    return null
  }
}

export async function getActiveUserIds(): Promise<string[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("getActiveUserIds: missing SUPABASE_SERVICE_ROLE_KEY")
    return []
  }
  try {
    const supabase = await getSupabaseForContext()
    const { data, error } = await supabase
      .from("company_profile")
      .select("user_id")
      .not("company_name", "is", null)
      .not("company_name", "eq", "")

    if (error) {
      console.error("getActiveUserIds:", error.message)
      return []
    }
    return (data ?? []).map((d) => d.user_id as string)
  } catch (e) {
    console.error("getActiveUserIds error:", e)
    return []
  }
}

async function loadProfile(
  supabase: SupabaseClient,
  organizationId: string | undefined,
): Promise<CompanyProfile> {
  if (!organizationId) {
    throw new Error("No active organization. Pick an organization or create one first.")
  }

  const { data, error } = await supabase
    .from("company_profile")
    .select("*")
    .eq("organization_id", organizationId)
    .single()

  if (error || !data) {
    throw new Error(
      `No company profile for this organization (${organizationId}). The founder needs to fill in their company profile first.`,
    )
  }

  return mapRowToCompanyProfile(data as Record<string, unknown>)
}

async function loadWorkspaceProfile(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<CompanyProfile> {
  const { data, error } = await supabase
    .from("client_workspace_profiles")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (error) {
    console.error("[company-context] loadWorkspaceProfile:", error.message)
    throw error
  }

  if (!data) {
    return mapRowToCompanyProfile({
      id: `pending-${workspaceId}`,
      user_id: userId,
      owner_user_id: userId,
      workspace_id: workspaceId,
    })
  }

  return mapRowToCompanyProfile(data as Record<string, unknown>)
}

function mapRowToCompanyProfile(row: Record<string, unknown>): CompanyProfile {
  const userId = String(row.user_id ?? "")
  const companyName = (row.company_name as string) || (row.name as string) || ""
  const tagline = (row.tagline as string) || ""
  const problem = (row.problem as string) || (row.problem_statement as string) || ""
  const solution = (row.solution as string) || (row.solution_description as string) || ""
  const targetMarket = (row.target_market as string) || (row.market as string) || ""
  const industry = (row.industry as string) || ""

  const description =
    (row.description as string) ||
    (row.company_description as string) ||
    [tagline, problem].filter(Boolean).join(" - ").slice(0, 2000) ||
    ""

  return {
    id: String(row.id),
    user_id: String(row.user_id ?? userId),
    name: companyName,
    description,
    problem,
    solution,
    market: targetMarket,
    industry,
    vertical: (row.vertical as string) || industry || "",
    stage: (row.stage as string) || (row.company_stage as string) || "unknown",
    business_model: (row.business_model as string) || "",
    founder_name: (row.founder_name as string) || "",
    founder_background: (row.founder_background as string) || "",
    founder_location: (row.founder_location as string) || "",
    thesis: (row.thesis as string) || "",
    icp: parseArray(row.icp),
    competitors: parseArray(row.competitors),
    keywords: parseArray(row.keywords),
    differentiators: (row.differentiators as string) || (row.unique_value as string) || "",
    traction: (row.traction as string) || "",
    brand_voice_dna: resolveBrandVoiceDna(row),
    brand_promise: (row.brand_promise as string) || "",
    brand_channel_voice: parseBrandChannelVoice(row.brand_channel_voice),
    brand_words_use: resolveBrandWordsUse(row),
    brand_words_never: resolveBrandWordsNever(row),
    brand_credibility_hooks: resolveBrandCredibilityHooks(row),
    brand_voice: (row.brand_voice as string) || "",
    brand_never_say: (row.brand_never_say as string) || "",
    brand_proof_points: (row.brand_proof_points as string) || "",
    knowledge_base_md: (row.knowledge_base_md as string) || "",
    knowledge_base_updated_at: (row.knowledge_base_updated_at as string | null | undefined) ?? null,
    github_vault_repo: (row.github_vault_repo as string) || "",
    github_vault_branch: (row.github_vault_branch as string) || "main",
    vault_folders: parseArray(row.vault_folders),
    vault_context_cache: (row.vault_context_cache as string) || "",
    vault_context_last_synced_at: (row.vault_context_last_synced_at as string | null | undefined) ?? null,
    vault_context_file_count: Number(row.vault_context_file_count ?? 0) || 0,
    vault_context_sync_error: (row.vault_context_sync_error as string | null | undefined) ?? null,
    whatsapp_number: (row.whatsapp_number as string | null | undefined) ?? null,
    whatsapp_verified: Boolean(row.whatsapp_verified),
    reddit_intent_subreddits: parseRedditIntentSubreddits(row.reddit_intent_subreddits),
    raw: row,
  }
}

async function loadAssets(
  supabase: SupabaseClient,
  organizationId: string | undefined,
  maxAssets: number,
  maxChars: number,
): Promise<CompanyAsset[]> {
  if (!organizationId) return []

  const { data, error } = await supabase
    .from("company_assets")
    .select("id, type, title, source_url, content, created_at")
    .eq("organization_id", organizationId)
    .not("content", "is", null)
    .order("created_at", { ascending: false })
    .limit(maxAssets + 8)

  if (error || !data?.length) return []

  const sorted = [...data].sort((a, b) => {
    if (a.type === "pitch_deck" && b.type !== "pitch_deck") return -1
    if (b.type === "pitch_deck" && a.type !== "pitch_deck") return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return sorted.slice(0, maxAssets).map((a) => ({
    id: a.id,
    type: normalizeAssetType(a.type),
    name: a.title || "Untitled",
    content: truncate(a.content || "", maxChars),
    created_at: a.created_at,
    source_url: a.source_url,
  }))
}

async function loadWorkspaceAssets(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  maxAssets: number,
  maxChars: number,
): Promise<CompanyAsset[]> {
  const { data, error } = await supabase
    .from("client_workspace_assets")
    .select("id, type, title, source_url, content, created_at")
    .eq("owner_user_id", userId)
    .eq("workspace_id", workspaceId)
    .not("content", "is", null)
    .order("created_at", { ascending: false })
    .limit(maxAssets + 8)

  if (error || !data?.length) return []

  const sorted = [...data].sort((a, b) => {
    if (a.type === "pitch_deck" && b.type !== "pitch_deck") return -1
    if (b.type === "pitch_deck" && a.type !== "pitch_deck") return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return sorted.slice(0, maxAssets).map((a) => ({
    id: a.id,
    type: normalizeAssetType(a.type),
    name: a.title || "Untitled",
    content: truncate(a.content || "", maxChars),
    created_at: a.created_at,
    source_url: a.source_url,
  }))
}

function normalizeAssetType(t: string | null): CompanyAssetType {
  if (t === "pitch_deck" || t === "document") return t
  if (t === "scraped_url") return "scrape"
  return "other"
}

function buildPromptBlock(profile: CompanyProfile, assets: CompanyAsset[] = []): string {
  const structuredLines: string[] = []
  const channelVoice = profile.brand_channel_voice

  if (profile.name) structuredLines.push(`Company: ${profile.name}`)
  if (profile.description) structuredLines.push(`Description: ${profile.description}`)
  if (profile.problem) structuredLines.push(`Problem: ${profile.problem}`)
  if (profile.solution) structuredLines.push(`Solution: ${profile.solution}`)
  if (profile.market) structuredLines.push(`Market: ${profile.market}`)
  if (profile.vertical || profile.industry) structuredLines.push(`Vertical/Industry: ${profile.vertical || profile.industry}`)
  if (profile.stage) structuredLines.push(`Stage: ${profile.stage}`)
  if (profile.business_model) structuredLines.push(`Business model: ${profile.business_model}`)
  if (profile.thesis) structuredLines.push(`Thesis: ${profile.thesis}`)
  if (profile.differentiators) structuredLines.push(`Differentiators: ${profile.differentiators}`)
  if (profile.traction) structuredLines.push(`Traction: ${profile.traction}`)
  if (profile.founder_name) structuredLines.push(`Founder: ${profile.founder_name}`)
  if (profile.founder_location) structuredLines.push(`Founder location: ${profile.founder_location}`)
  if (profile.founder_background) structuredLines.push(`Founder background: ${profile.founder_background}`)
  if (profile.icp.length > 0) structuredLines.push(`ICP: ${profile.icp.join(", ")}`)
  if (profile.competitors.length > 0) structuredLines.push(`Competitors: ${profile.competitors.join(", ")}`)
  if (profile.keywords.length > 0) structuredLines.push(`Keywords: ${profile.keywords.join(", ")}`)

  const voiceDna = profile.brand_voice_dna.trim() || profile.brand_voice.trim()
  if (voiceDna) structuredLines.push(`Brand voice DNA:\n${voiceDna}`)
  if (profile.brand_promise.trim()) structuredLines.push(`Brand promise: ${profile.brand_promise.trim()}`)
  if (channelVoice.linkedin.trim()) structuredLines.push(`LinkedIn voice: ${channelVoice.linkedin.trim()}`)
  if (channelVoice.cold_email.trim()) structuredLines.push(`Cold email voice: ${channelVoice.cold_email.trim()}`)
  if (channelVoice.reddit_hn.trim()) structuredLines.push(`Reddit/HN voice: ${channelVoice.reddit_hn.trim()}`)
  if (profile.brand_words_use.length > 0) structuredLines.push(`Words to use: ${profile.brand_words_use.join(", ")}`)
  if (profile.brand_words_never.length > 0) structuredLines.push(`Words to avoid: ${profile.brand_words_never.join(", ")}`)
  if (profile.brand_credibility_hooks.length > 0) {
    structuredLines.push(`Credibility hooks:\n${profile.brand_credibility_hooks.map((hook) => `- ${hook}`).join("\n")}`)
  }

  const structuredBlock = structuredLines.length > 0 ? structuredLines.join("\n") : "No structured company profile saved yet."
  const knowledgeBaseBlock = profile.knowledge_base_md.trim() || "No knowledge base document saved yet."
  const vaultContextBlock =
    profile.vault_context_cache.trim()
    || (profile.github_vault_repo.trim()
      ? "Vault connected but no cached context is available yet. Run a sync from /dashboard/context."
      : "No Obsidian vault connected.")
  const assetsBlock = assets.length > 0
    ? assets
        .map((asset) => {
          const sourceLine = asset.source_url ? `Source: ${asset.source_url}\n` : ""
          return [
            `--- ${asset.type.toUpperCase()}: ${asset.name} ---`,
            sourceLine + asset.content.trim(),
          ]
            .filter(Boolean)
            .join("\n")
        })
        .join("\n\n")
    : "No uploaded documents or scraped assets saved yet."

  return [
    "=== COMPANY PROFILE ===",
    structuredBlock,
    "",
    "=== DOCUMENTS & ASSETS ===",
    assetsBlock,
    "",
    "=== KNOWLEDGE BASE ===",
    knowledgeBaseBlock,
    "",
    "=== VAULT CONTEXT ===",
    vaultContextBlock,
  ].join("\n")
}

function extractIntelligence(profile: CompanyProfile): CompanyContext["extracted"] {
  let competitors = [...profile.competitors]
  let keywords = [...profile.keywords]
  let icp = [...profile.icp]

  if (keywords.length === 0) {
    const text = `${profile.description} ${profile.market} ${profile.vertical} ${profile.problem}`
    keywords = text
      .toLowerCase()
      .split(/[\s,;.]+/)
      .filter((w) => w.length > 3)
      .filter((w) => !STOP_WORDS.has(w))
      .slice(0, 10)
  }

  const nameLower = profile.name.toLowerCase()
  if (profile.name && !keywords.includes(nameLower)) {
    keywords = [nameLower, ...keywords]
  }
  const vert = profile.vertical || profile.industry
  if (vert && !keywords.includes(vert.toLowerCase())) {
    keywords = [vert.toLowerCase(), ...keywords]
  }

  return {
    competitors,
    keywords,
    icp,
    vertical: profile.vertical || profile.industry || "technology",
    stage: profile.stage || "unknown",
  }
}

function parseArray(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean) as string[]
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val) as unknown
      if (Array.isArray(parsed)) return parsed.filter(Boolean) as string[]
    } catch {
      return val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  return []
}

function parseJsonStringArray(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) {
    return val
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean)
      }
    } catch {
      return val
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  return []
}

function parseBrandChannelVoice(val: unknown): BrandChannelVoice {
  const empty: BrandChannelVoice = { linkedin: "", cold_email: "", reddit_hn: "" }
  if (!val || typeof val !== "object" || Array.isArray(val)) return empty
  const o = val as Record<string, unknown>
  return {
    linkedin: String(o.linkedin ?? "").trim(),
    cold_email: String(o.cold_email ?? "").trim(),
    reddit_hn: String(o.reddit_hn ?? o.reddit ?? "").trim(),
  }
}

function resolveBrandVoiceDna(row: Record<string, unknown>): string {
  const dna = (row.brand_voice_dna as string)?.trim()
  if (dna) return dna
  return (row.brand_voice as string) || ""
}

function resolveBrandWordsUse(row: Record<string, unknown>): string[] {
  const fromJson = parseJsonStringArray(row.brand_words_use)
  if (fromJson.length > 0) return fromJson
  return []
}

function resolveBrandWordsNever(row: Record<string, unknown>): string[] {
  const fromJson = parseJsonStringArray(row.brand_words_never)
  if (fromJson.length > 0) return fromJson
  const legacy = (row.brand_never_say as string)?.trim()
  if (legacy) {
    return legacy
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function resolveBrandCredibilityHooks(row: Record<string, unknown>): string[] {
  const fromJson = parseJsonStringArray(row.brand_credibility_hooks)
  if (fromJson.length > 0) return fromJson
  const legacy = (row.brand_proof_points as string)?.trim()
  if (legacy) {
    return legacy
      .split(/[\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.substring(0, maxChars) + "\n[...truncated]"
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "have",
  "been",
  "will",
  "they",
  "their",
  "which",
  "about",
  "into",
  "more",
  "other",
  "than",
  "also",
  "what",
  "when",
  "your",
  "some",
  "just",
  "like",
  "make",
  "help",
  "need",
  "very",
  "most",
  "does",
  "each",
  "over",
])

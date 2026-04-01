/**
 * Company Context Engine - the BRAIN.
 * Every agent calls getCompanyContext() before scrapers or model calls.
 *
 * Layers (in order):
 *   1. Structured profile (company_profile)
 *   2. Primary markdown knowledge base (company_profile.knowledge_base_md)
 *   3. Cached Obsidian vault digest (company_profile.vault_context_cache)
 *
 * Output: structured CompanyContext + promptBlock for system prompts.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveWorkspaceSelection } from "@/lib/workspaces"

export interface CompanyContext {
  userId: string
  scope?: "owner" | "workspace"
  workspaceId?: string | null
  workspaceSlug?: string | null
  workspaceDisplayName?: string | null
  profile: CompanyProfile
  assets: CompanyAsset[]
  /** Deprecated live GitHub reads; preserved as an empty array for compatibility. */
  vaultFiles: Array<{ path: string; content: string }>
  /** Deprecated live vault search hits; preserved as an empty array for compatibility. */
  knowledgeHits: string[]
  /** Pre-formatted block for Claude / Gemini system prompts */
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
  raw: Record<string, unknown>
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

export interface GetCompanyContextOptions {
  queryHint?: string
  maxAssets?: number
  maxAssetChars?: number
  workspaceId?: string | null
  useCookieWorkspace?: boolean
}

async function getSupabaseForContext(): Promise<SupabaseClient> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { supabaseAdmin } = await import("@/lib/supabase")
    return supabaseAdmin
  }
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
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
    const profile = workspace
      ? await loadWorkspaceProfile(supabase, userId, workspace.id)
      : await loadProfile(supabase, userId)
    const assets = workspace
      ? await loadWorkspaceAssets(supabase, userId, workspace.id, maxAssets, maxAssetChars)
      : await loadAssets(supabase, userId, maxAssets, maxAssetChars)
    const extracted = extractIntelligence(profile)

    return {
      userId,
      scope: workspace ? "workspace" : "owner",
      workspaceId: workspace?.id ?? null,
      workspaceSlug: workspace?.slug ?? null,
      workspaceDisplayName: workspace?.displayName ?? null,
      profile,
      assets,
      vaultFiles: [],
      knowledgeHits: [],
      promptBlock: buildPromptBlock(profile),
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

async function loadProfile(supabase: SupabaseClient, userId: string): Promise<CompanyProfile> {
  const { data, error } = await supabase.from("company_profile").select("*").eq("user_id", userId).single()

  if (error || !data) {
    throw new Error(
      `No company profile for user ${userId}. The founder needs to fill in their company profile first.`,
    )
  }

  return mapRowToCompanyProfile(data as Record<string, unknown>, userId)
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
    .single()

  if (error || !data) {
    throw new Error(
      `No workspace profile for workspace ${workspaceId}. The contact still needs to submit their context.`,
    )
  }

  return mapRowToCompanyProfile(data as Record<string, unknown>, userId)
}

function mapRowToCompanyProfile(row: Record<string, unknown>, userId: string): CompanyProfile {
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
    raw: row,
  }
}

async function loadAssets(
  supabase: SupabaseClient,
  userId: string,
  maxAssets: number,
  maxChars: number,
): Promise<CompanyAsset[]> {
  const { data, error } = await supabase
    .from("company_assets")
    .select("id, type, title, source_url, content, created_at")
    .eq("user_id", userId)
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

function buildPromptBlock(profile: CompanyProfile): string {
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

  return [
    "=== COMPANY PROFILE ===",
    structuredBlock,
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

/**
 * Company Context Engine — the BRAIN.
 * Every agent calls getCompanyContext() before scrapers or Claude.
 *
 * Layers (in order):
 *   1. Structured profile (company_profile)
 *   2. Assets (company_assets: pitch deck, docs, scrapes)
 *   3. Semantic memory (Supermemory)
 *
 * Output: structured CompanyContext + promptBlock for system prompts.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { queryMemory } from "@/lib/supermemory"

// ─── Types ───────────────────────────────────────────────────────

export interface CompanyContext {
  userId: string
  profile: CompanyProfile
  assets: CompanyAsset[]
  memoryHits: string[]
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
  /** E.164 WhatsApp; optional — see `company_profile` migration */
  whatsapp_number?: string | null
  whatsapp_verified?: boolean | null
  /** Full row for forward-compat / extra columns */
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
  /** Hint for Supermemory search (e.g. "competitors funding" for CBS) */
  queryHint?: string
  maxAssets?: number
  maxAssetChars?: number
}

// ─── Supabase: service role when available (Inngest / API), else cookie client ─

async function getSupabaseForContext(): Promise<SupabaseClient> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { supabaseAdmin } = await import("@/lib/supabase")
    return supabaseAdmin
  }
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

// ─── Main entry points ───────────────────────────────────────────

/**
 * Full assembled context for a user. Call this first in every agent.
 */
export async function getCompanyContext(
  userId: string | undefined,
  options: GetCompanyContextOptions = {},
): Promise<CompanyContext | null> {
  if (!userId) return null

  const { queryHint, maxAssets = 5, maxAssetChars = 3000 } = options

  try {
    const supabase = await getSupabaseForContext()

    const profile = await loadProfile(supabase, userId)
    const assets = await loadAssets(supabase, userId, maxAssets, maxAssetChars)
    const memoryHits = await queryMemoryLayer(userId, queryHint, profile)

    const extracted = extractIntelligence(profile)
    const promptBlock = buildPromptBlock(profile, assets, memoryHits)

    return {
      userId,
      profile,
      assets,
      memoryHits,
      promptBlock,
      extracted,
    }
  } catch (e) {
    console.error("getCompanyContext error:", e)
    return null
  }
}

/**
 * Convenience: prompt string only (backward compatible with older string-only APIs).
 */
export async function getCompanyContextPrompt(
  userId: string | undefined,
  options: GetCompanyContextOptions = {},
): Promise<string> {
  const ctx = await getCompanyContext(userId, options)
  return ctx?.promptBlock ?? ""
}

/**
 * Profile + extracted fields only (no assets / memory / prompt block).
 */
export async function getCompanyContextLight(
  userId: string,
): Promise<{ profile: CompanyProfile; extracted: CompanyContext["extracted"] } | null> {
  try {
    const supabase = await getSupabaseForContext()
    const profile = await loadProfile(supabase, userId)
    const extracted = extractIntelligence(profile)
    return { profile, extracted }
  } catch (e) {
    console.error("getCompanyContextLight error:", e)
    return null
  }
}

/**
 * Fan-out: user IDs that have a non-empty company name.
 */
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

// ─── Layer 1: Profile ────────────────────────────────────────────

async function loadProfile(supabase: SupabaseClient, userId: string): Promise<CompanyProfile> {
  const { data, error } = await supabase.from("company_profile").select("*").eq("user_id", userId).single()

  if (error || !data) {
    throw new Error(
      `No company profile for user ${userId}. The founder needs to fill in their company profile first.`,
    )
  }

  const row = data as Record<string, unknown>

  const companyName = (row.company_name as string) || (row.name as string) || ""
  const tagline = (row.tagline as string) || ""
  const problem = (row.problem as string) || (row.problem_statement as string) || ""
  const solution = (row.solution as string) || (row.solution_description as string) || ""
  const targetMarket = (row.target_market as string) || (row.market as string) || ""
  const industry = (row.industry as string) || ""

  const description =
    (row.description as string) ||
    (row.company_description as string) ||
    [tagline, problem].filter(Boolean).join(" — ").slice(0, 2000) ||
    ""

  return {
    id: String(row.id),
    user_id: String(row.user_id),
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
    whatsapp_number: (row.whatsapp_number as string | null | undefined) ?? null,
    whatsapp_verified: Boolean(row.whatsapp_verified),
    raw: row as Record<string, unknown>,
  }
}

// ─── Layer 2: Assets ─────────────────────────────────────────────

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

function normalizeAssetType(t: string | null): CompanyAssetType {
  if (t === "pitch_deck" || t === "document") return t
  if (t === "scraped_url") return "scrape"
  return "other"
}

// ─── Layer 3: Supermemory ────────────────────────────────────────

async function queryMemoryLayer(
  userId: string,
  queryHint: string | undefined,
  profile: CompanyProfile,
): Promise<string[]> {
  const query =
    queryHint?.trim() ||
    `${profile.name} ${profile.vertical || profile.industry} ${profile.market} product strategy competitors`

  try {
    const results = await queryMemory(query, userId, 5)
    const list = Array.isArray(results) ? results : []
    return list
      .map((r: { content?: string; text?: string }) => r.content || r.text || "")
      .filter((s: string) => s.length > 20)
      .slice(0, 3)
  } catch (e) {
    console.warn("[Supermemory] Query failed (non-fatal):", e)
    return []
  }
}

// ─── Prompt block ─────────────────────────────────────────────────

function buildPromptBlock(
  profile: CompanyProfile,
  assets: CompanyAsset[],
  memoryHits: string[],
): string {
  const sections: string[] = []

  sections.push(`=== COMPANY CONTEXT ===`)

  if (profile.name) sections.push(`Company: ${profile.name}`)
  if (profile.description) sections.push(`Description: ${profile.description}`)
  if (profile.problem) sections.push(`Problem: ${profile.problem}`)
  if (profile.solution) sections.push(`Solution: ${profile.solution}`)
  if (profile.market) sections.push(`Market: ${profile.market}`)
  if (profile.vertical || profile.industry) {
    sections.push(`Vertical/Industry: ${profile.vertical || profile.industry}`)
  }
  if (profile.stage) sections.push(`Stage: ${profile.stage}`)
  if (profile.business_model) sections.push(`Business model: ${profile.business_model}`)
  if (profile.thesis) sections.push(`Thesis: ${profile.thesis}`)
  if (profile.differentiators) sections.push(`Differentiators: ${profile.differentiators}`)
  if (profile.traction) sections.push(`Traction: ${profile.traction}`)

  if (profile.founder_name) {
    sections.push(`\nFounder: ${profile.founder_name}`)
    if (profile.founder_location) sections.push(`Location: ${profile.founder_location}`)
    if (profile.founder_background) sections.push(`Background: ${profile.founder_background}`)
  }

  if (profile.competitors.length > 0) {
    sections.push(`\nCompetitors: ${profile.competitors.join(", ")}`)
  }
  if (profile.icp.length > 0) {
    sections.push(`Ideal customers: ${profile.icp.join(", ")}`)
  }
  if (profile.keywords.length > 0) {
    sections.push(`Keywords/topics: ${profile.keywords.join(", ")}`)
  }

  if (assets.length > 0) {
    sections.push(`\n=== COMPANY DOCUMENTS ===`)
    for (const asset of assets) {
      const label = asset.source_url ? `${asset.name} (${asset.type}) — ${asset.source_url}` : `${asset.name} (${asset.type})`
      sections.push(`\n--- ${label} ---`)
      sections.push(asset.content)
    }
  }

  if (memoryHits.length > 0) {
    sections.push(`\n=== ADDITIONAL CONTEXT FROM KNOWLEDGE BASE ===`)
    for (const hit of memoryHits) {
      sections.push(hit)
    }
  }

  sections.push(`\n=== END COMPANY CONTEXT ===`)

  return sections.join("\n")
}

// ─── Extracted intelligence ───────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────────────

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

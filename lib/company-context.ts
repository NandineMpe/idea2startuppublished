/**
 * Central company context retrieval.
 * All agents call getCompanyContext(userId) to inject persistent startup context.
 */

import { createClient } from "@/lib/supabase/server"
import { queryMemory } from "@/lib/supermemory"

const MAX_PROFILE_LENGTH = 800
const MAX_PITCH_DECK_LENGTH = 4000
const MAX_ASSET_LENGTH = 2000
const MAX_ASSETS_INCLUDED = 5

export interface CompanyProfileRow {
  company_name: string | null
  tagline: string | null
  problem: string | null
  solution: string | null
  target_market: string | null
  industry: string | null
  stage: string | null
  traction: string | null
  team_summary: string | null
  funding_goal: string | null
}

export interface CompanyAssetRow {
  type: string
  title: string
  source_url: string | null
  content: string | null
  created_at: string
}

function truncate(str: string, max: number): string {
  if (!str || str.length <= max) return str
  return str.slice(0, max) + "..."
}

export async function getCompanyContext(userId: string | undefined): Promise<string> {
  if (!userId) return ""

  try {
    const supabase = await createClient()
    const parts: string[] = []

    // 1. Company profile
    const { data: profile } = await supabase
      .from("company_profile")
      .select("company_name, tagline, problem, solution, target_market, industry, stage, traction, team_summary, funding_goal")
      .eq("user_id", userId)
      .single()

    if (profile) {
      const fields: string[] = []
      if (profile.company_name) fields.push(`Name: ${profile.company_name}`)
      if (profile.tagline) fields.push(`Tagline: ${profile.tagline}`)
      if (profile.problem) fields.push(`Problem: ${profile.problem}`)
      if (profile.solution) fields.push(`Solution: ${profile.solution}`)
      if (profile.target_market) fields.push(`Target Market: ${profile.target_market}`)
      if (profile.industry) fields.push(`Industry: ${profile.industry}`)
      if (profile.stage) fields.push(`Stage: ${profile.stage}`)
      if (profile.traction) fields.push(`Traction: ${profile.traction}`)
      if (profile.team_summary) fields.push(`Team: ${profile.team_summary}`)
      if (profile.funding_goal) fields.push(`Funding Goal: ${profile.funding_goal}`)
      if (fields.length > 0) {
        parts.push(`## Company Profile\n${truncate(fields.join(" | "), MAX_PROFILE_LENGTH)}`)
      }
    }

    // 2. Company assets (pitch deck first, then recent docs/scraped)
    const { data: assets } = await supabase
      .from("company_assets")
      .select("type, title, source_url, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_ASSETS_INCLUDED)

    if (assets && assets.length > 0) {
      const pitchDeck = assets.find((a) => a.type === "pitch_deck")
      const others = assets.filter((a) => a.type !== "pitch_deck")

      if (pitchDeck?.content) {
        parts.push(`## Pitch Deck\n${truncate(pitchDeck.content, MAX_PITCH_DECK_LENGTH)}`)
      }

      const otherChunks: string[] = []
      for (const a of others) {
        if (a.content) {
          otherChunks.push(`### ${a.title}${a.source_url ? ` (${a.source_url})` : ""}\n${truncate(a.content, MAX_ASSET_LENGTH)}`)
        }
      }
      if (otherChunks.length > 0) {
        parts.push(`## Key Documents & Scraped Content\n${otherChunks.join("\n\n")}`)
      }
    }

    // 3. Semantic memory (Supermemory) — relevant chunks
    try {
      const memories = await queryMemory("company startup product market traction team", userId)
      if (memories?.length > 0) {
        const memoryText = memories
          .slice(0, 3)
          .map((m: { content?: string }) => m.content ?? "")
          .filter(Boolean)
          .join("\n---\n")
        if (memoryText) {
          parts.push(`## Additional Context from Knowledge Base\n${truncate(memoryText, 1500)}`)
        }
      }
    } catch {
      // Non-fatal
    }

    if (parts.length === 0) return ""
    return parts.join("\n\n")
  } catch (error) {
    console.error("getCompanyContext error:", error)
    return ""
  }
}

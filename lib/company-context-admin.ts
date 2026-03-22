/**
 * Company context for Inngest / background jobs (no user cookies).
 * Uses service-role Supabase + Supermemory by userId.
 * Dynamic-imports Supabase so builds without env don't fail at module load.
 */

import { queryMemory } from "@/lib/supermemory"

const MAX_PROFILE_LENGTH = 800
const MAX_PITCH_DECK_LENGTH = 4000
const MAX_ASSET_LENGTH = 2000
const MAX_ASSETS_INCLUDED = 5

function truncate(str: string, max: number): string {
  if (!str || str.length <= max) return str
  return str.slice(0, max) + "..."
}

export async function getCompanyContextForJobs(userId: string): Promise<string> {
  if (!userId) return ""
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("getCompanyContextForJobs: missing SUPABASE_SERVICE_ROLE_KEY")
    return ""
  }

  try {
    const { supabaseAdmin } = await import("@/lib/supabase")
    const parts: string[] = []
    const supabase = supabaseAdmin

    const { data: profile } = await supabase
      .from("company_profile")
      .select(
        "company_name, tagline, problem, solution, target_market, industry, stage, traction, team_summary, funding_goal, founder_name, founder_location, founder_background",
      )
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

      const founderFields: string[] = []
      if (profile.founder_name) founderFields.push(`Founder: ${profile.founder_name}`)
      if (profile.founder_location) founderFields.push(`Location: ${profile.founder_location}`)
      if (profile.founder_background) founderFields.push(profile.founder_background)
      if (founderFields.length > 0) {
        parts.push(`## Founder Profile\n${truncate(founderFields.join("\n"), MAX_PROFILE_LENGTH)}`)
      }
    }

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
          otherChunks.push(
            `### ${a.title}${a.source_url ? ` (${a.source_url})` : ""}\n${truncate(a.content, MAX_ASSET_LENGTH)}`,
          )
        }
      }
      if (otherChunks.length > 0) {
        parts.push(`## Key Documents & Scraped Content\n${otherChunks.join("\n\n")}`)
      }
    }

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
      // non-fatal
    }

    if (parts.length === 0) return ""
    return parts.join("\n\n")
  } catch (e) {
    console.error("getCompanyContextForJobs error:", e)
    return ""
  }
}

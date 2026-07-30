import type { SupabaseClient } from "@supabase/supabase-js"
import { loadCareerDashboardContext } from "@/lib/careeros/dashboard/load-career-dashboard"
import {
  buildSkillToFeedCrosswalk,
  formatEnrichedLandscapeItem,
  formatFeedItemForChat,
  type EnrichedLandscapeRow,
} from "@/lib/careeros/feed-chat-context"

export type CareerContext = {
  userId: string
  promptBlock: string
  hasData: boolean
}

const MAX_BLOCK_CHARS = 14_000

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n\n[Truncated for chat length.]`
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
}

function summarizeExtraction(payload: Record<string, unknown> | null): string {
  if (!payload) return "No structured extraction on file yet."

  const skills = Array.isArray(payload.skills)
    ? (payload.skills as Array<{ skill_name?: string; source_type?: string }>)
        .map((s) => s.skill_name)
        .filter((n): n is string => typeof n === "string" && n.length > 0)
        .slice(0, 40)
    : []

  const roles = Array.isArray(payload.past_roles)
    ? (payload.past_roles as Array<{ title?: string; company?: string }>).slice(0, 6)
    : []

  const education = Array.isArray(payload.education) ? payload.education.length : 0
  const achievements = asStringList(payload.notable_achievements).slice(0, 5)

  const lines: string[] = []
  if (skills.length) lines.push(`Extracted skills (${skills.length} shown): ${skills.join(", ")}`)
  if (roles.length) {
    lines.push(
      "Past roles:",
      ...roles.map(
        (r) =>
          `- ${String(r.title ?? "Role")} @ ${String(r.company ?? "—")}`,
      ),
    )
  }
  if (education) lines.push(`Education entries: ${education}`)
  if (achievements.length) {
    lines.push("Notable achievements:", ...achievements.map((a) => `- ${a}`))
  }
  return lines.length ? lines.join("\n") : "Extraction exists but has little structured detail."
}

/**
 * Builds a prompt block from CareerOS tables (profile, skills, feed, health, market, extraction).
 */
export async function getCareerContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<CareerContext> {
  const dashboard = await loadCareerDashboardContext(supabase, userId)

  const [
    { data: fullProfile },
    { data: extractionRow },
    { data: feedRows },
    { data: healthRow },
    { data: adjacentSnapshot },
    { data: allSkills },
  ] = await Promise.all([
    supabase
      .schema("careeros")
      .from("user_profiles")
      .select(
        "current_role_title,target_role_title,location_label,years_experience,last_profile_extraction_id,profile_ready_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .schema("careeros")
      .from("user_document_extractions")
      .select("parsed_payload,extraction_method,created_at")
      .eq("user_id", userId)
      .eq("parser_name", "careeros-profile-extract")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("careeros")
      .from("user_ai_feed_items")
      .select(
        "title,feed_type,feed_at,personalised_note,relevance_score,item_payload,source_attribution",
      )
      .eq("user_id", userId)
      .is("dismissed_at", null)
      .order("feed_at", { ascending: false })
      .limit(12),
    supabase
      .schema("careeros")
      .from("user_career_health_reports")
      .select("score_overall,report_year,report_quarter,report_payload,created_at")
      .eq("user_id", userId)
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("careeros")
      .from("user_adjacent_role_snapshots")
      .select("id,source_role_soc_code,generated_at")
      .eq("user_id", userId)
      .eq("is_current", true)
      .maybeSingle(),
    supabase
      .schema("careeros")
      .from("user_skills")
      .select("skill_name,current_status,source_type")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("skill_name", { ascending: true })
      .limit(35),
  ])

  let adjacentItems: Array<{
    target_soc_code: string
    personalised_fit_score: number | null
    explain_payload: Record<string, unknown> | null
    rank_position: number
  }> = []

  if (adjacentSnapshot?.id) {
    const { data: items } = await supabase
      .schema("careeros")
      .from("user_adjacent_role_items")
      .select("target_soc_code,personalised_fit_score,explain_payload,rank_position")
      .eq("snapshot_id", adjacentSnapshot.id)
      .order("rank_position", { ascending: true })
      .limit(5)
    adjacentItems = (items ?? []).map((row) => ({
      target_soc_code: String(row.target_soc_code),
      personalised_fit_score:
        typeof row.personalised_fit_score === "number" ? row.personalised_fit_score : null,
      explain_payload:
        row.explain_payload && typeof row.explain_payload === "object"
          ? (row.explain_payload as Record<string, unknown>)
          : null,
      rank_position: Number(row.rank_position),
    }))
  }

  const sections: string[] = []

  sections.push("## Career profile")
  if (fullProfile) {
    const p = fullProfile
    if (p.current_role_title) sections.push(`Current role: ${p.current_role_title}`)
    if (p.target_role_title) sections.push(`Target role: ${p.target_role_title}`)
    if (p.location_label) sections.push(`Location: ${p.location_label}`)
    if (typeof p.years_experience === "number") sections.push(`Years experience: ${p.years_experience}`)
  } else {
    sections.push("No profile row yet.")
  }
  if (dashboard.profileHeadline) sections.push(`Headline: ${dashboard.profileHeadline}`)
  sections.push(`Onboarding complete: ${dashboard.onboardingComplete ? "yes" : "no"}`)
  sections.push(`Extraction status: ${dashboard.extractionStatus}`)

  sections.push("\n## Skill portfolio")
  const skills = allSkills ?? []
  if (skills.length === 0) {
    sections.push("No active skills in portfolio.")
  } else {
    for (const s of skills) {
      const st = s.current_status ? ` (${s.current_status})` : ""
      sections.push(`- ${s.skill_name}${st} · source: ${s.source_type ?? "unknown"}`)
    }
  }

  sections.push("\n## Latest document extraction")
  if (extractionRow) {
    sections.push(
      `Method: ${extractionRow.extraction_method ?? "unknown"} · ${extractionRow.created_at ?? ""}`,
    )
    sections.push(
      summarizeExtraction(
        (extractionRow.parsed_payload as Record<string, unknown> | null) ?? null,
      ),
    )
  } else {
    sections.push("No profile extraction run yet.")
  }

  const userSkillNames = (allSkills ?? []).map((s) => String(s.skill_name))

  const landscapeSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: landscapeRows } = await supabase
    .schema("careeros")
    .from("feed_items_enriched")
    .select(
      "enriched_summary,entity_type,entities,affected_functions,affected_skills,significance_score,feed_source_items!inner(title,source_key,published_at)",
    )
    .gte("enrichment_completed_at", landscapeSince)
    .order("significance_score", { ascending: false })
    .limit(8)

  sections.push("\n## Sector AI signal (high significance, last 14 days)")
  const landscape = (landscapeRows ?? []) as EnrichedLandscapeRow[]
  if (!landscape.length) {
    sections.push("No enriched sector items in the last two weeks. Run feed ingest.")
  } else {
    landscape.forEach((row, i) => sections.push(formatEnrichedLandscapeItem(row, i)))
  }

  sections.push("\n## Your personalised AI feed")
  if (!feedRows?.length) {
    sections.push("No personalised feed items yet. Finish onboarding and wait for feed personalisation.")
  } else {
    feedRows.forEach((item, i) =>
      sections.push(formatFeedItemForChat(item, userSkillNames, i)),
    )
  }

  sections.push("\n## Your skills × feed (crosswalk)")
  if (!userSkillNames.length) {
    sections.push("No skills in portfolio to map.")
  } else if (!feedRows?.length) {
    sections.push("Add feed items via ingest, then re-ask about AI changes.")
  } else {
    const crosswalk = buildSkillToFeedCrosswalk(userSkillNames, feedRows)
    sections.push(...(crosswalk.length ? crosswalk : ["No skill-to-headline links yet."]))
  }

  sections.push("\n## Career health report")
  if (!healthRow) {
    sections.push("No health report generated yet.")
  } else {
    sections.push(
      `Overall score: ${healthRow.score_overall ?? "—"} · ${healthRow.report_quarter ?? ""} ${healthRow.report_year ?? ""}`,
    )
    const payload = healthRow.report_payload as Record<string, unknown> | null
    if (payload?.narrative_intro && typeof payload.narrative_intro === "string") {
      sections.push(String(payload.narrative_intro).slice(0, 1200))
    }
    if (Array.isArray(payload?.pillars)) {
      const pillars = payload.pillars as Array<{ name?: string; score?: number; blurb?: string }>
      for (const p of pillars.slice(0, 5)) {
        sections.push(`- ${p.name ?? "Pillar"}: ${p.score ?? "—"} — ${(p.blurb ?? "").slice(0, 200)}`)
      }
    }
  }

  sections.push("\n## Market · adjacent roles")
  if (adjacentSnapshot?.source_role_soc_code) {
    sections.push(`Source role SOC: ${adjacentSnapshot.source_role_soc_code}`)
  }
  if (!adjacentItems.length) {
    sections.push("No adjacent role recommendations stored.")
  } else {
    for (const a of adjacentItems) {
      const bridge = Array.isArray(a.explain_payload?.bridge_skills)
        ? (a.explain_payload!.bridge_skills as string[]).slice(0, 4).join(", ")
        : ""
      sections.push(
        `- SOC ${a.target_soc_code} · fit ${a.personalised_fit_score ?? "—"}${bridge ? ` · bridge: ${bridge}` : ""}`,
      )
    }
  }

  const promptBlock = truncate(sections.join("\n"), MAX_BLOCK_CHARS)
  const hasData =
    Boolean(fullProfile) ||
    skills.length > 0 ||
    Boolean(extractionRow) ||
    Boolean(feedRows?.length) ||
    Boolean(healthRow)

  return { userId, promptBlock, hasData }
}

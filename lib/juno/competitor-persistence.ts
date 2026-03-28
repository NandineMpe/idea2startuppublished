import type { CompanyContext } from "@/lib/company-context"
import { supabaseAdmin } from "@/lib/supabase"
import type { CompetitorEvent, ScoredItem } from "@/lib/juno/types"

export type CompetitorTrackingRow = {
  id: string
  user_id: string
  competitor_name: string
  competitor_url: string | null
  event_type: string
  title: string
  description: string | null
  url: string | null
  source: string | null
  why_it_matters: string | null
  threat_level: string | null
  suggested_response: string | null
  funding_amount: string | null
  funding_round: string | null
  lead_investor: string | null
  event_date: string | null
  discovered_at: string
  is_acknowledged: boolean
  created_at: string
}

export type FundingTrackerRow = {
  id: string
  user_id: string
  company_name: string
  company_url: string | null
  is_competitor: boolean
  is_in_our_space: boolean
  round_type: string | null
  amount: string | null
  valuation: string | null
  lead_investor: string | null
  other_investors: string[] | null
  announced_date: string | null
  relevance: string | null
  signal: string | null
  threat_or_opportunity: string | null
  url: string | null
  source: string | null
  discovered_at: string
  created_at: string
}

function hasSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function competitorEventExistsRecently(
  userId: string,
  companyName: string,
  eventType: string,
): Promise<boolean> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from("competitor_tracking")
    .select("id")
    .eq("user_id", userId)
    .eq("competitor_name", companyName)
    .eq("event_type", eventType)
    .gte("discovered_at", sevenDaysAgo)
    .limit(1)

  if (error) {
    console.warn("[competitor-persistence] dedupe check:", error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

async function fundingRoundExistsRecently(
  userId: string,
  companyName: string,
  announcedDate: string | null,
  roundType: string | null,
): Promise<boolean> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let q = supabaseAdmin
    .from("funding_tracker")
    .select("id")
    .eq("user_id", userId)
    .eq("company_name", companyName)
    .gte("discovered_at", sevenDaysAgo)
    .limit(1)

  if (announcedDate) q = q.eq("announced_date", announcedDate)
  if (roundType) q = q.eq("round_type", roundType)

  const { data, error } = await q
  if (error) {
    console.warn("[competitor-persistence] funding dedupe:", error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

function isCompetitorName(ce: CompetitorEvent, competitors: string[]): boolean {
  const n = ce.companyName.toLowerCase()
  return competitors.some((c) => n.includes(c.toLowerCase()) || c.toLowerCase().includes(n))
}

/**
 * Persist scored items that include `competitorEvent` to Supabase (deduped within 7 days).
 */
export async function persistCompetitorEvents(
  userId: string,
  scoredItems: ScoredItem[],
  context: CompanyContext,
): Promise<{ competitorInserts: number; fundingInserts: number }> {
  if (!hasSupabase()) {
    return { competitorInserts: 0, fundingInserts: 0 }
  }

  const competitors = context.extracted?.competitors ?? []
  let competitorInserts = 0
  let fundingInserts = 0

  for (const item of scoredItems) {
    const ce = item.competitorEvent
    if (!ce || !ce.companyName?.trim() || !ce.eventType?.trim()) continue

    const companyName = ce.companyName.trim()
    const eventType = ce.eventType.trim().toLowerCase().replace(/\s+/g, "_")

    if (await competitorEventExistsRecently(userId, companyName, eventType)) continue

    const eventDateStr = item.publishedAt ? item.publishedAt.split("T")[0] : null

    const { error: cErr } = await supabaseAdmin.from("competitor_tracking").insert({
      user_id: userId,
      competitor_name: companyName,
      competitor_url: ce.competitorUrl ?? null,
      event_type: eventType,
      title: item.title,
      description: item.description || null,
      url: item.url || null,
      source: item.source || null,
      why_it_matters: item.whyItMatters || null,
      threat_level: ce.threatLevel ?? null,
      suggested_response: ce.suggestedResponse ?? item.suggestedAction ?? null,
      funding_amount: ce.fundingAmount ?? null,
      funding_round: ce.fundingRound ?? null,
      lead_investor: ce.leadInvestor ?? null,
      event_date: eventDateStr,
    })

    if (cErr) {
      console.error("[competitor-persistence] competitor_tracking insert:", cErr.message)
      continue
    }
    competitorInserts += 1

    if (eventType === "funding") {
      const isCompetitor = isCompetitorName({ ...ce, companyName }, competitors)
      if (
        await fundingRoundExistsRecently(
          userId,
          companyName,
          eventDateStr,
          ce.fundingRound ?? null,
        )
      ) {
        continue
      }

      const { error: fErr } = await supabaseAdmin.from("funding_tracker").insert({
        user_id: userId,
        company_name: companyName,
        is_competitor: isCompetitor,
        is_in_our_space: true,
        round_type: ce.fundingRound ?? null,
        amount: ce.fundingAmount ?? null,
        lead_investor: ce.leadInvestor ?? null,
        announced_date: eventDateStr,
        relevance: item.whyItMatters ?? null,
        signal: isCompetitor ? "competitive_threat" : "market_validation",
        threat_or_opportunity: isCompetitor ? "threat" : "opportunity",
        url: item.url || null,
        source: item.source || null,
      })

      if (fErr) console.error("[competitor-persistence] funding_tracker insert:", fErr.message)
      else fundingInserts += 1
    }
  }

  return { competitorInserts, fundingInserts }
}

export async function loadCompetitorContext30d(userId: string): Promise<CompetitorTrackingRow[]> {
  if (!hasSupabase()) return []
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from("competitor_tracking")
    .select("*")
    .eq("user_id", userId)
    .gte("discovered_at", thirtyDaysAgo)
    .order("discovered_at", { ascending: false })
    .limit(10)

  if (error) {
    console.warn("[competitor-persistence] loadCompetitorContext30d:", error.message)
    return []
  }
  return (data ?? []) as CompetitorTrackingRow[]
}

export async function loadFundingContext90d(userId: string): Promise<FundingTrackerRow[]> {
  if (!hasSupabase()) return []
  const cutoffTime = Date.now() - 90 * 24 * 60 * 60 * 1000

  const { data, error } = await supabaseAdmin
    .from("funding_tracker")
    .select("*")
    .eq("user_id", userId)
    .order("announced_date", { ascending: false, nullsFirst: false })
    .limit(40)

  if (error) {
    console.warn("[competitor-persistence] loadFundingContext90d:", error.message)
    return []
  }

  const rows = (data ?? []) as FundingTrackerRow[]
  return rows
    .filter((r) => {
      if (r.announced_date) return new Date(r.announced_date).getTime() >= cutoffTime
      return new Date(r.discovered_at).getTime() >= cutoffTime
    })
    .slice(0, 20)
}

export async function loadCompetitorTrackingForVault(userId: string): Promise<CompetitorTrackingRow[]> {
  if (!hasSupabase()) return []
  const { data, error } = await supabaseAdmin
    .from("competitor_tracking")
    .select("*")
    .eq("user_id", userId)
    .order("discovered_at", { ascending: false })
    .limit(80)

  if (error) {
    console.warn("[competitor-persistence] loadCompetitorTrackingForVault:", error.message)
    return []
  }
  return (data ?? []) as CompetitorTrackingRow[]
}

export async function loadFundingTrackerForVault(userId: string): Promise<FundingTrackerRow[]> {
  if (!hasSupabase()) return []
  const cutoffTime = Date.now() - 90 * 24 * 60 * 60 * 1000

  const { data, error } = await supabaseAdmin
    .from("funding_tracker")
    .select("*")
    .eq("user_id", userId)
    .order("announced_date", { ascending: false, nullsFirst: false })
    .limit(60)

  if (error) {
    console.warn("[competitor-persistence] loadFundingTrackerForVault:", error.message)
    return []
  }

  const rows = (data ?? []) as FundingTrackerRow[]
  return rows
    .filter((r) => {
      if (r.announced_date) return new Date(r.announced_date).getTime() >= cutoffTime
      return new Date(r.discovered_at).getTime() >= cutoffTime
    })
    .slice(0, 40)
}

/** Staff meeting: broader snapshot (last ~90 days of competitor rows). */
export async function loadCompetitorTrackingRecent(
  userId: string,
  limit = 20,
): Promise<CompetitorTrackingRow[]> {
  if (!hasSupabase()) return []
  const { data, error } = await supabaseAdmin
    .from("competitor_tracking")
    .select("*")
    .eq("user_id", userId)
    .order("discovered_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.warn("[competitor-persistence] loadCompetitorTrackingRecent:", error.message)
    return []
  }
  return (data ?? []) as CompetitorTrackingRow[]
}

export async function loadFundingTrackerRecent(
  userId: string,
  limit = 20,
): Promise<FundingTrackerRow[]> {
  if (!hasSupabase()) return []
  const { data, error } = await supabaseAdmin
    .from("funding_tracker")
    .select("*")
    .eq("user_id", userId)
    .order("announced_date", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.warn("[competitor-persistence] loadFundingTrackerRecent:", error.message)
    return []
  }
  return (data ?? []) as FundingTrackerRow[]
}

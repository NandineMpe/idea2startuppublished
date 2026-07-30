import { getOnetAuthHeaders } from "@/lib/careeros/integrations/onet-request"

export type MarketVendorId = "onet" | "adzuna" | "jsearch" | "theirstack" | "supabase" | "inngest"

export type MarketDataSource = {
  id: MarketVendorId
  label: string
  configured: boolean
  /** What this vendor powers on the market page. */
  used_for: string
}

export type MarketCapabilities = {
  sources: MarketDataSource[]
  /** Vendor used for the live open-postings count on page load. */
  live_postings_vendor: "adzuna" | "jsearch" | "theirstack" | null
  /** Per-role employer links (TheirStack only today). */
  job_listings_live: boolean
  onet_configured: boolean
  inngest_configured: boolean
  any_job_count_api: boolean
  any_market_refresh_api: boolean
}

function adzunaConfigured(): boolean {
  return Boolean(
    process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim(),
  )
}

function jsearchConfigured(): boolean {
  return Boolean(
    process.env.JSEARCH_API_KEY?.trim() || process.env.RAPIDAPI_KEY?.trim(),
  )
}

function theirstackConfigured(): boolean {
  return Boolean(process.env.THEIRSTACK_API_KEY?.trim())
}

function onetConfigured(): boolean {
  return getOnetAuthHeaders() != null
}

function inngestConfigured(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY?.trim())
}

/** Detect which external vendors are wired in this deployment. */
export function getMarketCapabilities(): MarketCapabilities {
  const onet = onetConfigured()
  const adzuna = adzunaConfigured()
  const jsearch = jsearchConfigured()
  const theirstack = theirstackConfigured()
  const inngest = inngestConfigured()

  const live_postings_vendor: MarketCapabilities["live_postings_vendor"] = theirstack
    ? "theirstack"
    : adzuna
      ? "adzuna"
      : jsearch
        ? "jsearch"
        : null

  const sources: MarketDataSource[] = [
    {
      id: "onet",
      label: "O*NET",
      configured: onet,
      used_for: "SOC codes, adjacent role fit, occupation titles",
    },
    {
      id: "adzuna",
      label: "Adzuna",
      configured: adzuna,
      used_for: "Salary samples and demand/salary cache refresh",
    },
    {
      id: "jsearch",
      label: "JSearch",
      configured: jsearch,
      used_for: "Salary samples and demand cross-check",
    },
    {
      id: "theirstack",
      label: "TheirStack",
      configured: theirstack,
      used_for: "Live job listings and primary demand spine (optional)",
    },
    {
      id: "supabase",
      label: "CareerOS cache",
      configured: true,
      used_for: "market_demand_trajectories, market_salary_bands, market_adjacent_roles",
    },
    {
      id: "inngest",
      label: "Inngest",
      configured: inngest,
      used_for: "Background refresh for demand, salary, and adjacent roles",
    },
  ]

  return {
    sources: sources.filter((s) => s.configured || s.id === "supabase"),
    live_postings_vendor,
    job_listings_live: theirstack,
    onet_configured: onet,
    inngest_configured: inngest,
    any_job_count_api: live_postings_vendor != null,
    /** True when Inngest + O*NET can queue profile.onet-map or market refresh jobs. */
    any_market_refresh_api: inngest && onet,
  }
}

/** Active vendors only (for UI "Data sources" panel). */
export function getActiveMarketDataSources(): MarketDataSource[] {
  return getMarketCapabilities().sources.filter((s) => s.configured)
}

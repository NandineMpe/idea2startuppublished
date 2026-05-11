import { getDemandRegionProfile } from "@/lib/careeros/market/demand-regions"
import { delayForCareerOsVendor } from "@/lib/careeros/integrations/rate-limits"

export type MarketPosting = {
  source: "theirstack" | "adzuna"
  posting_id: string
  employer_name: string | null
  title: string
  location_text: string | null
  posted_at: string | null
  description_text: string
}

function safeText(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function norm(v: string | null | undefined): string {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function dedupeKey(p: MarketPosting): string {
  const day = (p.posted_at ?? "").slice(0, 10)
  return `${norm(p.employer_name)}|${norm(p.title)}|${day}`
}

function looksLikeRegion(text: string | null, regionCode: string): boolean {
  if (!text) return true
  const t = text.toLowerCase()
  const rc = regionCode.toLowerCase()
  if (rc === "global") return true
  if (rc.includes("us") && t.includes("us")) return true
  if (rc.includes("gb") && (t.includes("uk") || t.includes("london") || t.includes("england"))) return true
  if (rc === "ie" && t.includes("ireland")) return true
  if (rc === "de" && t.includes("germany")) return true
  if (rc === "nl" && t.includes("netherlands")) return true
  if (rc === "au" && t.includes("australia")) return true
  if (rc === "ca" && t.includes("canada")) return true
  return true
}

export async function fetchPostingsForVelocity(params: {
  region_code: string
  jobTitle: string
  lookbackDays: number
  maxPerSource?: number
}): Promise<{ postings: MarketPosting[]; sourceStats: Record<string, unknown> }> {
  const region = getDemandRegionProfile(params.region_code)
  const maxPerSource = Math.max(20, Math.min(200, params.maxPerSource ?? 80))
  const all: MarketPosting[] = []
  const sourceStats: Record<string, unknown> = {}

  // Adzuna samples
  const appId = process.env.ADZUNA_APP_ID?.trim()
  const appKey = process.env.ADZUNA_APP_KEY?.trim()
  if (appId && appKey && region) {
    await delayForCareerOsVendor("adzuna")
    const url =
      `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(region.adzuna_country)}/search/1` +
      `?app_id=${encodeURIComponent(appId)}` +
      `&app_key=${encodeURIComponent(appKey)}` +
      `&results_per_page=${maxPerSource}` +
      `&what=${encodeURIComponent(params.jobTitle)}`
    const res = await fetch(url, { headers: { Accept: "application/json" } })
    const text = await res.text()
    if (res.ok) {
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>
        const rows = Array.isArray(parsed.results) ? parsed.results : []
        for (const row of rows) {
          if (!row || typeof row !== "object") continue
          const r = row as Record<string, unknown>
          const loc = safeText((r.location as Record<string, unknown> | undefined)?.display_name)
          const desc = safeText(r.description)
          if (!desc.trim()) continue
          if (!looksLikeRegion(loc, params.region_code)) continue
          all.push({
            source: "adzuna",
            posting_id: String(r.id ?? r.redirect_url ?? crypto.randomUUID()),
            employer_name: safeText((r.company as Record<string, unknown> | undefined)?.display_name) || null,
            title: safeText(r.title) || params.jobTitle,
            location_text: loc || null,
            posted_at: safeText(r.created) || null,
            description_text: desc,
          })
        }
      } catch {}
    }
    sourceStats.adzuna = { ok: res.ok, status: res.status }
  } else {
    sourceStats.adzuna = { ok: false, status: 0, reason: "missing_credentials_or_region" }
  }

  // TheirStack samples
  const tsKey = process.env.THEIRSTACK_API_KEY?.trim()
  if (tsKey && region) {
    await delayForCareerOsVendor("theirstack")
    const body = {
      limit: maxPerSource,
      posted_at_max_age_days: Math.min(730, Math.max(30, params.lookbackDays)),
      job_title_or: [params.jobTitle],
      job_country_code_or: region.theirstack_country_codes,
    }
    const res = await fetch("https://api.theirstack.com/v1/jobs/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tsKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "CareerOS-skill-velocity/1.0",
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if (res.ok) {
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>
        const rows = Array.isArray(parsed.data)
          ? parsed.data
          : Array.isArray(parsed.results)
            ? parsed.results
            : []
        for (const row of rows) {
          if (!row || typeof row !== "object") continue
          const r = row as Record<string, unknown>
          const desc = safeText(r.description || r.job_description || r.text)
          if (!desc.trim()) continue
          all.push({
            source: "theirstack",
            posting_id: String(r.id ?? r.uuid ?? crypto.randomUUID()),
            employer_name: safeText(r.company_name || r.company) || null,
            title: safeText(r.title || r.job_title) || params.jobTitle,
            location_text: safeText(r.location || r.location_name) || null,
            posted_at: safeText(r.posted_at || r.created_at) || null,
            description_text: desc,
          })
        }
      } catch {}
    }
    sourceStats.theirstack = { ok: res.ok, status: res.status }
  } else {
    sourceStats.theirstack = { ok: false, status: 0, reason: "missing_theirstack_key_or_region" }
  }

  const deduped = new Map<string, MarketPosting>()
  for (const p of all) {
    const k = dedupeKey(p)
    if (!deduped.has(k)) deduped.set(k, p)
  }

  return { postings: [...deduped.values()], sourceStats }
}

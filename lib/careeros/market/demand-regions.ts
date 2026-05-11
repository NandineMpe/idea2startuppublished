/**
 * Top 10 demand regions (curriculum spine). Maps internal region_code → vendor parameters.
 * Documented in docs/careeros/data-sources.md.
 */
export type DemandRegionProfile = {
  region_code: string
  label: string
  /** Adzuna API path segment (lowercase ISO-style country code). */
  adzuna_country: string
  /** ISO 3166-1 alpha-2 for filters where the vendor expects a country list. */
  theirstack_country_codes: string[]
  /** JSearch `location` query fragment (human-readable). */
  jsearch_location: string
}

export const DEMAND_TOP_REGIONS: DemandRegionProfile[] = [
  {
    region_code: "IE",
    label: "Ireland",
    adzuna_country: "ie",
    theirstack_country_codes: ["IE"],
    jsearch_location: "Ireland",
  },
  {
    region_code: "GB-LON",
    label: "United Kingdom — London",
    adzuna_country: "gb",
    theirstack_country_codes: ["GB"],
    jsearch_location: "London, UK",
  },
  {
    region_code: "GB",
    label: "United Kingdom",
    adzuna_country: "gb",
    theirstack_country_codes: ["GB"],
    jsearch_location: "United Kingdom",
  },
  {
    region_code: "US-NY",
    label: "United States — New York",
    adzuna_country: "us",
    theirstack_country_codes: ["US"],
    jsearch_location: "New York, US",
  },
  {
    region_code: "US-SF",
    label: "United States — San Francisco Bay Area",
    adzuna_country: "us",
    theirstack_country_codes: ["US"],
    jsearch_location: "San Francisco, US",
  },
  {
    region_code: "US",
    label: "United States",
    adzuna_country: "us",
    theirstack_country_codes: ["US"],
    jsearch_location: "United States",
  },
  {
    region_code: "DE",
    label: "Germany",
    adzuna_country: "de",
    theirstack_country_codes: ["DE"],
    jsearch_location: "Germany",
  },
  {
    region_code: "NL",
    label: "Netherlands",
    adzuna_country: "nl",
    theirstack_country_codes: ["NL"],
    jsearch_location: "Netherlands",
  },
  {
    region_code: "AU",
    label: "Australia",
    adzuna_country: "au",
    theirstack_country_codes: ["AU"],
    jsearch_location: "Australia",
  },
  {
    region_code: "CA",
    label: "Canada",
    adzuna_country: "ca",
    theirstack_country_codes: ["CA"],
    jsearch_location: "Canada",
  },
]

export function getDemandRegionProfile(region_code: string): DemandRegionProfile | undefined {
  return DEMAND_TOP_REGIONS.find((r) => r.region_code === region_code)
}

/** Map user profile.location_region_code (free text / ISO) to a demand spine region. */
export function matchUserRegionToDemandRegion(userRegion: string | null | undefined): string | null {
  if (!userRegion?.trim()) return null
  const u = userRegion.trim().toUpperCase()
  // Prefer longest / most specific codes first (same order as manual tuning).
  const ordered = [...DEMAND_TOP_REGIONS].sort((a, b) => b.region_code.length - a.region_code.length)
  for (const r of ordered) {
    if (u === r.region_code.toUpperCase()) return r.region_code
    if (u.includes(r.region_code.replace("-", ""))) continue
  }
  if (u.startsWith("IE") || u === "IRELAND") return "IE"
  if (u.startsWith("GB") || u.includes("UK") || u.includes("LONDON")) return "GB-LON"
  if (u.includes("NEW YORK") || u === "NY") return "US-NY"
  if (u.includes("SAN FRANCISCO") || u.includes("BAY AREA")) return "US-SF"
  if (u.startsWith("US") || u.includes("USA")) return "US"
  if (u.startsWith("DE")) return "DE"
  if (u.startsWith("NL")) return "NL"
  if (u.startsWith("AU")) return "AU"
  if (u.startsWith("CA")) return "CA"
  return null
}

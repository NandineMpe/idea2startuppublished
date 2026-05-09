/**
 * Vendor rate limits and CareerOS pacing targets for external data integrations.
 * Keep in sync with `docs/careeros/module-0.2-readiness.md` (Source limits & published quotas).
 */

/** Published caps as stated by vendors (approximate; confirm before relying in court/compliance). */
export type PublishedVendorCaps = {
  maxRequestsPerSecond?: number
  maxRequestsPerMinute?: number
  maxRequestsPerHour?: number
  maxRequestsPerDay?: number
  maxRequestsPerWeek?: number
  maxRequestsPerMonth?: number
  /** Rolling window, e.g. BLS 50 requests per 10 seconds */
  maxRequestsPerWindow?: number
  windowMs?: number
  /** Other structured limits */
  maxSeriesPerQuery?: number
  maxConcurrentConnections?: number
  /** When limits are not public or depend on contract/tier */
  notPublished?: boolean
  planOrContractSpecific?: boolean
}

/** Conservative defaults for CareerOS workers (batch jobs, cache refresh, Inngest steps). */
export type CareerOSPacing = {
  /** Hard ceiling for sustained request rate */
  maxRequestsPerSecond?: number
  maxRequestsPerMinute?: number
  maxRequestsPerDay?: number
  /** When one API key is shared across multiple CareerOS pipelines */
  maxRequestsPerIntegrationSlicePerDay?: number
  maxRequestsPerWeek?: number
  maxRequestsPerMonth?: number
  maxRequestsPerWindow?: number
  windowMs?: number
  maxConcurrentConnections?: number
  /** Minimum milliseconds between successive calls at this integration (derived helper may use this) */
  minIntervalMs?: number
}

export type VendorRateLimitProfile = {
  key: VendorIntegrationKey
  displayName: string
  documentationUrl: string
  published: PublishedVendorCaps
  careeros: CareerOSPacing
  notes?: string
}

export const VENDOR_INTEGRATION_KEYS = [
  "onet",
  "careeronestop",
  "adzuna",
  "jsearch",
  "theirstack",
  "bls",
  "levelsfyi",
  "eurostat",
  "cso_ireland",
  "crunchbase",
  "sec_edgar",
  "layoffs_fyi",
  "arxiv",
  "learning_providers",
] as const

export type VendorIntegrationKey = (typeof VENDOR_INTEGRATION_KEYS)[number]

export const CAREEROS_VENDOR_RATE_LIMITS: Record<
  VendorIntegrationKey,
  VendorRateLimitProfile
> = {
  onet: {
    key: "onet",
    displayName: "O*NET Web Services",
    documentationUrl: "https://services.onetcenter.org/terms",
    published: {
      maxRequestsPerSecond: 5,
      maxRequestsPerDay: 50_000,
    },
    careeros: {
      maxRequestsPerSecond: 4,
      maxRequestsPerDay: 45_000,
      minIntervalMs: 250,
    },
  },
  careeronestop: {
    key: "careeronestop",
    displayName: "CareerOneStop API",
    documentationUrl:
      "https://www.careeronestop.org/Developers/WebAPI/web-api.aspx",
    published: {
      notPublished: true,
    },
    careeros: {
      maxRequestsPerSecond: 1,
      minIntervalMs: 1000,
    },
    notes:
      "No public numeric cap in open docs; default conservative pacing and backoff.",
  },
  adzuna: {
    key: "adzuna",
    displayName: "Adzuna API",
    documentationUrl: "https://developer.adzuna.com/docs/terms_of_service",
    published: {
      maxRequestsPerMinute: 25,
      maxRequestsPerDay: 250,
      maxRequestsPerWeek: 1000,
      maxRequestsPerMonth: 2500,
    },
    careeros: {
      maxRequestsPerMinute: 20,
      maxRequestsPerDay: 220,
      minIntervalMs: 3000,
    },
  },
  jsearch: {
    key: "jsearch",
    displayName: "JSearch (RapidAPI)",
    documentationUrl:
      "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch",
    published: {
      planOrContractSpecific: true,
      notPublished: true,
    },
    careeros: {},
    notes:
      "Quota comes from your RapidAPI subscription; enforce outside this table once known.",
  },
  theirstack: {
    key: "theirstack",
    displayName: "TheirStack API",
    documentationUrl: "https://theirstack.com/en/docs/api-reference/rate-limit",
    published: {
      maxRequestsPerSecond: 4,
      maxRequestsPerMinute: 10,
      maxRequestsPerHour: 50,
      maxRequestsPerDay: 400,
    },
    careeros: {
      maxRequestsPerSecond: 3,
      minIntervalMs: 334,
    },
    notes:
      "Published numbers are free-tier windows; paid tier removes day/hour/minute caps but keeps per-second (see vendor docs). Prefer RateLimit-* response headers when wired.",
  },
  bls: {
    key: "bls",
    displayName: "BLS Public Data API v2",
    documentationUrl: "https://www.bls.gov/developers/api_features.htm",
    published: {
      maxRequestsPerDay: 500,
      maxRequestsPerWindow: 50,
      windowMs: 10_000,
      maxSeriesPerQuery: 50,
    },
    careeros: {
      maxRequestsPerIntegrationSlicePerDay: 45,
      maxRequestsPerWindow: 45,
      windowMs: 10_000,
      minIntervalMs: 200,
    },
    notes:
      "Per-slice daily budget when sharing one registration key across integrations; stay under vendor 500/day total.",
  },
  levelsfyi: {
    key: "levelsfyi",
    displayName: "Levels.fyi API",
    documentationUrl: "https://www.levels.fyi/api-access/",
    published: {
      planOrContractSpecific: true,
      notPublished: true,
    },
    careeros: {
      maxRequestsPerSecond: 2,
      minIntervalMs: 500,
    },
    notes: "Replace careeros caps with contract terms when issued.",
  },
  eurostat: {
    key: "eurostat",
    displayName: "Eurostat API",
    documentationUrl:
      "https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access",
    published: {
      maxConcurrentConnections: 4,
      notPublished: true,
    },
    careeros: {
      maxConcurrentConnections: 4,
    },
  },
  cso_ireland: {
    key: "cso_ireland",
    displayName: "CSO Ireland (PxWeb)",
    documentationUrl: "https://www.cso.ie/en/statistics/webapi/",
    published: {
      notPublished: true,
    },
    careeros: {
      maxConcurrentConnections: 4,
      maxRequestsPerSecond: 1,
      minIntervalMs: 1000,
    },
  },
  crunchbase: {
    key: "crunchbase",
    displayName: "Crunchbase Data API",
    documentationUrl: "https://data.crunchbase.com/",
    published: {
      planOrContractSpecific: true,
      notPublished: true,
    },
    careeros: {},
    notes: "Observe dashboard quota and HTTP 429.",
  },
  sec_edgar: {
    key: "sec_edgar",
    displayName: "SEC EDGAR / data.sec.gov",
    documentationUrl:
      "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
    published: {
      maxRequestsPerSecond: 10,
    },
    careeros: {
      maxRequestsPerSecond: 8,
      minIntervalMs: 125,
    },
    notes: "Identify User-Agent per SEC fair-access guidance.",
  },
  layoffs_fyi: {
    key: "layoffs_fyi",
    displayName: "Layoffs.fyi",
    documentationUrl: "https://layoffs.fyi/",
    published: {
      notPublished: true,
    },
    careeros: {
      maxRequestsPerSecond: 0.2,
      minIntervalMs: 5000,
    },
    notes: "No REST quota; treat scraping lightly if permitted — prefer static dumps.",
  },
  arxiv: {
    key: "arxiv",
    displayName: "arXiv API",
    documentationUrl: "https://info.arxiv.org/help/api/tou.html",
    published: {
      notPublished: true,
    },
    careeros: {
      maxRequestsPerSecond: 1,
      minIntervalMs: 1000,
    },
    notes: "Prefer bulk data exports for large corpora.",
  },
  learning_providers: {
    key: "learning_providers",
    displayName:
      "Coursera / Udemy / Pluralsight / DataCamp / edX (partner APIs)",
    documentationUrl: "https://www.coursera.org/partnerships",
    published: {
      planOrContractSpecific: true,
      notPublished: true,
    },
    careeros: {},
    notes: "No automation until commercial quota is agreed.",
  },
}

/**
 * Minimum delay between consecutive requests for a vendor, using CareerOS pacing.
 * Uses `minIntervalMs` when set; otherwise derives from `maxRequestsPerSecond`.
 */
export function careerosMinIntervalMs(key: VendorIntegrationKey): number {
  const profile = CAREEROS_VENDOR_RATE_LIMITS[key]
  if (profile.careeros.minIntervalMs != null) {
    return profile.careeros.minIntervalMs
  }
  const rps = profile.careeros.maxRequestsPerSecond
  if (rps != null && rps > 0) {
    return Math.ceil(1000 / rps)
  }
  return 0
}

/**
 * Conservative daily budget for splitting schedules (e.g. Inngest cron slices).
 */
export function careerosMaxRequestsPerDay(key: VendorIntegrationKey): number | undefined {
  return CAREEROS_VENDOR_RATE_LIMITS[key].careeros.maxRequestsPerDay
}

/**
 * When multiple pipelines share one vendor API key (see BLS guidance in Module 0.2 docs).
 */
export function careerosMaxRequestsPerIntegrationSlicePerDay(
  key: VendorIntegrationKey
): number | undefined {
  return CAREEROS_VENDOR_RATE_LIMITS[key].careeros
    .maxRequestsPerIntegrationSlicePerDay
}

/**
 * Use between sequential HTTP calls in Inngest steps or workers so outbound
 * traffic respects {@link careerosMinIntervalMs}.
 */
export function delayForCareerOsVendor(key: VendorIntegrationKey): Promise<void> {
  const ms = careerosMinIntervalMs(key)
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

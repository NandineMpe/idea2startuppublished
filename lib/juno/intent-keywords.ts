/** Primary intent phrases — direct product-seeking + problem + recommendations */
export const INTENT_KEYWORDS_PRIMARY: string[] = [
  "insurance software",
  "insurtech",
  "insurance platform",
  "insurance automation",
  "policy management software",
  "insurance AI",
  "claims automation",
  "insurance tech stack",
  "best insurance software",
  "looking for insurance tool",
  "insurance startup",
  "embedded insurance",
  "insurance API",
  "insurance underwriting software",
  "digital insurance",
  "insurance claims software",
  "what do you use for insurance",
  "how do you handle claims",
  "insurance compliance",
  "insurance data",
]

/** Broader market signals — buyer pain, switching, evaluation */
export const INTENT_KEYWORDS_SECONDARY: string[] = [
  "switching insurance provider",
  "insurance broker software",
  "insurance CRM",
  "policy administration",
  "loss ratio",
  "actuarial software",
  "insurance distribution",
  "MGA software",
  "reinsurance",
  "insurance regulation",
]

/** GTM and buyer-behavior phrases */
export const INTENT_KEYWORDS_OUTREACH: string[] = [
  "B2B sales",
  "cold email",
  "cold outreach",
  "sales outreach",
  "demo email",
  "book a demo",
  "vendor email",
]

export const COMPETITOR_KEYWORDS: string[] = [
  "Lemonade",
  "Root Insurance",
  "Hippo",
  "Next Insurance",
  "Openly",
  "Cowbell",
  "Coalition",
  "At-Bay",
  "Slice Labs",
]

/**
 * Default pool for Reddit intent scans (no r/ prefix). Deduped lowercase at merge time.
 * Insurtech / insurance / founder communities.
 */
export const REDDIT_SUBREDDITS: string[] = [
  // Insurance & insurtech core
  "Insurance",
  "insurtech",
  "InsuranceAgent",
  "InsuranceProfessional",
  "HealthInsurance",
  "CarInsurance",
  "HomeInsurance",
  "LifeInsurance",
  "BusinessInsurance",
  "WorkersComp",
  // Fintech adjacent
  "fintech",
  "financialindependence",
  "personalfinance",
  // Startup & founder communities
  "startups",
  "entrepreneur",
  "saas",
  "smallbusiness",
  "Entrepreneur",
  // Risk & compliance
  "riskmanagement",
  "LegalAdvice",
  "legaladviceofftopic",
]

/** Highest-signal subs scanned first in the 12-sub cap. */
export const REDDIT_SUBREDDIT_SCAN_PRIORITY: string[] = [
  "insurance",
  "insurtech",
  "startups",
  "fintech",
  "InsuranceAgent",
  "saas",
]

/** Short high-recall tokens */
export const INTENT_SHORT_TOKENS: string[] = [
  "insurance",
  "insurtech",
  "underwriting",
  "claims",
  "policy",
  "coverage",
  "broker",
  "outreach",
  "demo",
]

export function buildKeywordList(profileKeywords: string[] | undefined): string[] {
  const fromProfile = (profileKeywords ?? [])
    .map((k) => k.trim())
    .filter((k) => k.length > 2)
    .slice(0, 12)
  const merged = [
    ...new Set([
      ...INTENT_SHORT_TOKENS,
      ...INTENT_KEYWORDS_OUTREACH,
      ...INTENT_KEYWORDS_SECONDARY.slice(0, 8),
      ...INTENT_KEYWORDS_PRIMARY,
      ...fromProfile,
    ]),
  ]
  return merged.slice(0, 32)
}

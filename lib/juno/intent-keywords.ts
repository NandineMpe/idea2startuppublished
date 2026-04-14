/** Primary intent phrases — direct product-seeking + problem + recommendations */
export const INTENT_KEYWORDS_PRIMARY: string[] = [
  "audit management software",
  "audit prep tool",
  "audit readiness",
  "compliance automation",
  "compliance software",
  "SOX compliance",
  "GAAP",
  "audit evidence",
  "continuous compliance",
  "audit AI",
  "audit prep is",
  "preparing for audit",
  "first audit",
  "audit findings",
  "control gaps",
  "compliance burden",
  "manual audit",
  "audit documentation",
  "recommend audit",
  "best audit software",
  "looking for audit",
  "what do you use for audit",
  "how do you handle audit",
]

/** Use with finance/audit context in prompts (narrower search) */
export const INTENT_KEYWORDS_SECONDARY: string[] = [
  "scaling compliance",
  "automate financial reporting",
  "SEC reporting",
  "internal controls",
  "revenue recognition",
  "ASC 606",
  "lease accounting",
  "IFRS compliance",
  "financial close automation",
  "audit trail",
]

/** GTM and buyer-behavior phrases (search fallback and matched keyword metadata) */
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
  "FloQast",
  "AuditBoard",
  "Trullion",
  "Leapfin",
  "Workiva",
  "Trintech",
  "BlackLine",
]

/**
 * Default pool for Reddit intent scans (no r/ prefix). Deduped lowercase at merge time.
 * Mix finance/compliance buyers with B2B sales and operator communities (outreach, demos, GTM).
 */
export const REDDIT_SUBREDDITS: string[] = [
  "accounting",
  "bookkeeping",
  "cpa",
  "tax",
  "auditing",
  "fintech",
  "startups",
  "saas",
  "entrepreneur",
  "smallbusiness",
  "CFOs",
  "sales",
  "revops",
]

/** Always merged first when not using a user-pinned list — keeps GTM and buyer voice in the 12-sub cap. */
export const REDDIT_SUBREDDIT_SCAN_PRIORITY: string[] = [
  "cfos",
  "sales",
  "saas",
  "startups",
  "accounting",
  "fintech",
]

/** Short high-recall tokens — paired with longer phrases so searches still return rows */
export const INTENT_SHORT_TOKENS: string[] = [
  "audit",
  "compliance",
  "SOX",
  "audit prep",
  "internal controls",
  "controller",
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

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

export const COMPETITOR_KEYWORDS: string[] = [
  "FloQast",
  "AuditBoard",
  "Trullion",
  "Leapfin",
  "Workiva",
  "Trintech",
  "BlackLine",
]

/** Default subreddits for audit / finance / startup buyers */
export const REDDIT_SUBREDDITS: string[] = [
  "accounting",
  "Accounting",
  "CFO",
  "Bookkeeping",
  "auditing",
  "CPA",
  "startups",
  "SaaS",
  "fintech",
  "smallbusiness",
  "Entrepreneur",
]

/** Short high-recall tokens — paired with longer phrases so searches still return rows */
export const INTENT_SHORT_TOKENS: string[] = [
  "audit",
  "compliance",
  "SOX",
  "audit prep",
  "internal controls",
  "controller",
]

export function buildKeywordList(profileKeywords: string[] | undefined): string[] {
  const fromProfile = (profileKeywords ?? [])
    .map((k) => k.trim())
    .filter((k) => k.length > 2)
    .slice(0, 12)
  const merged = [
    ...new Set([
      ...INTENT_SHORT_TOKENS,
      ...INTENT_KEYWORDS_SECONDARY.slice(0, 8),
      ...INTENT_KEYWORDS_PRIMARY,
      ...fromProfile,
    ]),
  ]
  return merged.slice(0, 32)
}

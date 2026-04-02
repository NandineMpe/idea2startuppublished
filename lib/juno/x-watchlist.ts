import type { CompanyContext } from "@/lib/company-context"

export const X_WATCH_TERM_LIMIT = 24

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export function normalizeXWatchTerm(value: string): string {
  const compact = compactWhitespace(value)
  if (!compact) return ""
  const cleaned = compact.replace(/^[,;|]+|[,;|]+$/g, "").trim()
  return cleaned.slice(0, 120)
}

export function normalizeXWatchTerms(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const value of values) {
    const normalized = normalizeXWatchTerm(value)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
    if (out.length >= X_WATCH_TERM_LIMIT) break
  }

  return out
}

export function buildXWatchTermsFromContext(context: CompanyContext): string[] {
  return normalizeXWatchTerms([
    ...context.extracted.keywords,
    ...context.extracted.competitors,
  ])
}

export function buildXWatchSuggestions(
  keywords: string[],
  competitors: string[],
  extra: string[] = [],
): string[] {
  return normalizeXWatchTerms([...competitors, ...extra, ...keywords]).slice(0, 10)
}


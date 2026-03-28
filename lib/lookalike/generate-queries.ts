import { buildApolloPeopleSearchUrl } from "@/lib/apollo-search-url"
import type { LookalikeDimensions, PlatformQuery } from "@/types/lookalike"
import { dimensionsToLegacyCriteria } from "./derive-legacy"

function buildApolloSearchURL(d: LookalikeDimensions): string {
  const legacy = dimensionsToLegacyCriteria(d)
  return buildApolloPeopleSearchUrl({
    targetTitles: legacy.targetTitles,
    companyTypes: legacy.companyTypes,
    geography: legacy.geography,
    companySize: legacy.companySize,
  })
}

/**
 * Layer 2 — deterministic platform-native query strings from the weighted profile.
 */
export function generatePlatformQueries(dimensions: LookalikeDimensions): PlatformQuery[] {
  const d = dimensions
  const queries: PlatformQuery[] = []

  const salesNavFilters: string[] = []
  if (d.personTitle.matchTerms.length > 0) {
    salesNavFilters.push(`Title: ${d.personTitle.matchTerms.join(" OR ")}`)
  }
  if (d.personTitle.excludeTerms.length > 0) {
    salesNavFilters.push(`Exclude title: ${d.personTitle.excludeTerms.join(", ")}`)
  }
  if (d.personFunction.functions.length > 0) {
    salesNavFilters.push(`Function: ${d.personFunction.functions.join(", ")}`)
  }
  if (d.companyType.types.length > 0) {
    salesNavFilters.push(`Company type: ${d.companyType.types.join(", ")}`)
  }
  if (d.companySize.ranges.length > 0) {
    salesNavFilters.push(`Company headcount: ${d.companySize.ranges.join(", ")}`)
  }
  if (d.geography.countries.length > 0) {
    salesNavFilters.push(`Geography: ${d.geography.countries.join(", ")}`)
  }
  if (d.geography.cities.length > 0) {
    salesNavFilters.push(`Cities: ${d.geography.cities.join(", ")}`)
  }
  if (d.industryContext.industries.length > 0) {
    salesNavFilters.push(`Industry: ${d.industryContext.industries.join(", ")}`)
  }

  queries.push({
    platform: "linkedin_sales_nav",
    query: salesNavFilters.join("\n"),
    url: null,
    estimatedResults: "50-200",
  })

  const apolloFilters: string[] = []
  if (d.personTitle.matchTerms.length > 0) {
    apolloFilters.push(`Person title contains: ${d.personTitle.matchTerms.join(", ")}`)
  }
  if (d.personFunction.functions.length > 0) {
    apolloFilters.push(
      `Department: ${d.personFunction.functions.map((f) => f.charAt(0).toUpperCase() + f.slice(1)).join(", ")}`,
    )
  }
  if (d.companyType.types.length > 0) {
    apolloFilters.push(
      `Company industry: ${d.companyType.types.map((t) => t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ")).join(", ")}`,
    )
  }
  if (d.companySize.ranges.length > 0) {
    apolloFilters.push(`Company size: ${d.companySize.ranges.join(", ")}`)
  }
  const locParts = [...d.geography.countries, ...d.geography.cities]
  if (locParts.length > 0) {
    apolloFilters.push(`Location: ${locParts.join(", ")}`)
  }

  queries.push({
    platform: "apollo",
    query: apolloFilters.join("\n"),
    url: buildApolloSearchURL(d),
    estimatedResults: "50-200",
  })

  const titlePart =
    d.personTitle.matchTerms.length > 0
      ? d.personTitle.matchTerms.map((t) => `"${t}"`).join(" OR ")
      : '"director" OR "partner"'
  const functionPart =
    d.personFunction.functions.length > 0
      ? d.personFunction.functions.map((f) => `"${f}"`).join(" OR ")
      : '"advisory" OR "consulting"'
  const geoPart =
    locParts.length > 0
      ? locParts.map((c) => `"${c}"`).join(" OR ")
      : '"United States"'
  const excludePart =
    d.personTitle.excludeTerms.length > 0
      ? ` NOT (${d.personTitle.excludeTerms.map((t) => `"${t}"`).join(" OR ")})`
      : ""

  const booleanQuery = `(${titlePart}) AND (${functionPart}) AND (${geoPart})${excludePart}`

  queries.push({
    platform: "linkedin_boolean",
    query: booleanQuery,
    url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(booleanQuery)}`,
    estimatedResults: "20-100",
  })

  return queries
}

/** Maps platform queries to the legacy three-string shape + Apollo deep link. */
export function platformQueriesToLegacySearch(
  dimensions: LookalikeDimensions,
  list: PlatformQuery[],
): {
  linkedinSalesNav: string
  apollo: string
  linkedinBoolean: string
  apolloAppUrl: string
} {
  const by = new Map(list.map((q) => [q.platform, q]))
  const sn = by.get("linkedin_sales_nav")?.query ?? ""
  const ap = by.get("apollo")?.query ?? ""
  const lb = by.get("linkedin_boolean")?.query ?? ""
  const apolloUrl = by.get("apollo")?.url ?? buildApolloSearchURL(dimensions)
  return {
    linkedinSalesNav: sn,
    apollo: ap,
    linkedinBoolean: lb,
    apolloAppUrl: apolloUrl,
  }
}

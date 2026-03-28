import type { LookalikeDimensions } from "@/types/lookalike"

/** Maps 7-dimension profile to the legacy pill / Apollo URL shape used by the GTM UI. */
export function dimensionsToLegacyCriteria(d: LookalikeDimensions): {
  targetTitles: string[]
  companyTypes: string[]
  geography: string[]
  companySize: string[]
} {
  const titles =
    d.personTitle.matchTerms.length > 0
      ? d.personTitle.matchTerms
      : d.personTitle.seniorityMin
        ? [d.personTitle.seniorityMin.replace(/_/g, " ")]
        : ["Decision maker"]

  const companyTypes =
    d.companyType.types.length > 0
      ? d.companyType.types.map((t) => t.replace(/_/g, " "))
      : d.industryContext.industries.length > 0
        ? d.industryContext.industries.map((t) => t.replace(/_/g, " "))
        : ["Similar companies"]

  const geography = [
    ...d.geography.countries,
    ...d.geography.cities,
    ...d.geography.regions,
  ].filter(Boolean)

  let companySize = [...d.companySize.ranges]
  if (companySize.length === 0) {
    if (d.companySize.minEmployees != null || d.companySize.maxEmployees != null) {
      const a = d.companySize.minEmployees ?? ""
      const b = d.companySize.maxEmployees ?? ""
      companySize = [`${a}${a !== "" || b !== "" ? "–" : ""}${b}`.trim() || "11–200"]
    } else {
      companySize = ["11–200"]
    }
  }

  return {
    targetTitles: titles.slice(0, 24),
    companyTypes: companyTypes.slice(0, 24),
    geography: geography.length > 0 ? geography.slice(0, 16) : ["Regional"],
    companySize: companySize.slice(0, 12),
  }
}

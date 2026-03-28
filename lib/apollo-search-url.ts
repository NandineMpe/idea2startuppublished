/**
 * Deep-link into Apollo web app (free tier) with filters pre-filled.
 * URL shape may vary as Apollo updates their SPA; filters still land users on People search.
 */

export type ApolloLookalikeInput = {
  targetTitles: string[]
  companyTypes: string[]
  geography: string[]
  companySize?: string[]
}

const APOLLO_PEOPLE_HASH = "#/people"

/** Max URL length for safety (some browsers ~2000+). */
const MAX_LEN = 1800

/**
 * Build https://app.apollo.io/#/people?... with personTitles[], personLocations[], optional keywords.
 * @see https://knowledge.apollo.io — filter names align with common Apollo query params.
 */
export function buildApolloPeopleSearchUrl(criteria: ApolloLookalikeInput): string {
  const base = "https://app.apollo.io/"
  const params = new URLSearchParams()

  const titles = (criteria.targetTitles ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 6)
  for (const t of titles) {
    params.append("personTitles[]", t)
  }

  const locs = (criteria.geography ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 4)
  for (const loc of locs) {
    params.append("personLocations[]", loc)
  }

  const qs = params.toString()
  let path = `${base}${APOLLO_PEOPLE_HASH}`
  if (qs) path += `?${qs}`
  if (path.length > MAX_LEN) {
    const shortParams = new URLSearchParams()
    for (const t of titles.slice(0, 3)) shortParams.append("personTitles[]", t)
    for (const loc of locs.slice(0, 2)) shortParams.append("personLocations[]", loc)
    path = `${base}${APOLLO_PEOPLE_HASH}?${shortParams.toString()}`
  }
  return path
}

/**
 * Researcher — gathers public signals about a founder + company using Exa.
 *
 * Sources gathered:
 *   1. Company website (full crawl, up to 8 pages)
 *   2. Founder LinkedIn profile page
 *   3. Recent press / mentions (news search)
 *   4. ProductHunt listing (if exists)
 *   5. Founder Twitter/X profile
 *   6. Job postings (signals team shape + priorities)
 *   7. Competitor pages (derived from company description)
 *
 * Returns a flat `ResearchBundle` that the synthesizer turns into
 * structured company_profile fields + a knowledge_base_md document.
 */

import Exa from "exa-js"

export interface ResearchInput {
  targetEmail: string
  founderName: string
  companyName: string
  companyUrl: string
  companyDomain?: string
  linkedinUrl?: string
  twitterUrl?: string
}

export interface ResearchBundle {
  founderName: string
  companyName: string
  companyUrl: string
  websitePages: string[]       // raw text from their site
  founderProfile: string       // LinkedIn / public bio text
  pressSnippets: string[]      // recent news/mentions
  productHuntText: string      // PH listing copy + comments
  twitterPosts: string[]       // recent founder tweets
  jobPostings: string[]        // job ad text (signals priorities)
  competitorSnippets: string[] // brief text on apparent competitors
}

function getExa(): Exa {
  const key = process.env.EXA_API?.trim() || process.env.EXA_API_KEY?.trim()
  if (!key) throw new Error("EXA_API_KEY is not set")
  return new Exa(key)
}

function normalizeDomain(value: string | undefined): string {
  const raw = (value ?? "").trim().toLowerCase()
  if (!raw) return ""

  const withoutProtocol = raw.replace(/^https?:\/\//, "")
  const hostOnly = withoutProtocol.split("/")[0]?.trim() ?? ""
  const cleaned = hostOnly.replace(/^www\./, "").replace(/:\d+$/, "")
  if (!cleaned) return ""
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleaned)) return ""
  return cleaned
}

/** Pull text from a URL via Exa's contents endpoint. Returns "" on failure. */
async function fetchPageText(exa: Exa, url: string): Promise<string> {
  try {
    const res = await exa.getContents([url], { text: { maxCharacters: 6000 } })
    return res.results?.[0]?.text?.trim() ?? ""
  } catch {
    return ""
  }
}

/** Neural search + text for up to `n` results. */
async function searchAndFetch(
  exa: Exa,
  query: string,
  n = 3,
  maxChars = 3000,
): Promise<string[]> {
  try {
    const res = await exa.searchAndContents(query, {
      numResults: n,
      text: { maxCharacters: maxChars },
      type: "neural",
    })
    return res.results
      .map((r) => [r.title ? `## ${r.title}` : "", r.text ?? ""].filter(Boolean).join("\n"))
      .filter(Boolean)
  } catch {
    return []
  }
}

export async function researchFounder(input: ResearchInput): Promise<ResearchBundle> {
  const exa = getExa()
  const { founderName, companyName, companyUrl, companyDomain, linkedinUrl, twitterUrl } = input
  const domain = normalizeDomain(companyDomain)
    || (() => {
      try {
        return normalizeDomain(new URL(companyUrl).hostname)
      } catch {
        return ""
      }
    })()

  // Run all fetches in parallel — total wall time ~10-15s
  const [
    websitePages,
    founderProfileText,
    pressSnippets,
    productHuntText,
    twitterPosts,
    jobPostings,
    competitorSnippets,
  ] = await Promise.all([
    // 1. Company website — crawl up to 8 pages rooted at their domain
    (async (): Promise<string[]> => {
      try {
        const query = domain ? `site:${domain}` : companyUrl
        const res = await exa.searchAndContents(query, {
          numResults: 8,
          text: { maxCharacters: 4000 },
          type: "keyword",
        })
        return res.results.map((r) => r.text ?? "").filter(Boolean)
      } catch {
        // fallback: just fetch the homepage
        const text = await fetchPageText(exa, companyUrl)
        return text ? [text] : []
      }
    })(),

    // 2. Founder LinkedIn / public bio
    (async (): Promise<string> => {
      if (linkedinUrl) {
        const text = await fetchPageText(exa, linkedinUrl)
        if (text) return text
      }
      // fallback neural search
      const snips = await searchAndFetch(exa, `${founderName} founder ${companyName} LinkedIn background`, 2, 4000)
      return snips.join("\n\n")
    })(),

    // 3. Press / mentions
    searchAndFetch(exa, `${companyName} startup "${founderName}" news funding launch`, 4, 2500),

    // 4. ProductHunt
    (async (): Promise<string> => {
      const snips = await searchAndFetch(
        exa,
        `site:producthunt.com ${companyName}`,
        2,
        4000,
      )
      return snips.join("\n\n")
    })(),

    // 5. Founder Twitter/X posts
    (async (): Promise<string[]> => {
      if (twitterUrl) {
        const text = await fetchPageText(exa, twitterUrl)
        if (text) return [text]
      }
      return searchAndFetch(exa, `${founderName} twitter site:x.com OR site:twitter.com founder ${companyName}`, 3, 2000)
    })(),

    // 6. Job postings — reveals roadmap + team shape
    searchAndFetch(exa, `${companyName} jobs hiring site:linkedin.com OR site:lever.co OR site:greenhouse.io`, 3, 2000),

    // 7. Competitor landscape
    searchAndFetch(exa, `${companyName} competitors alternatives vs comparison`, 4, 2000),
  ])

  return {
    founderName,
    companyName,
    companyUrl,
    websitePages,
    founderProfile: founderProfileText,
    pressSnippets,
    productHuntText,
    twitterPosts,
    jobPostings,
    competitorSnippets,
  }
}

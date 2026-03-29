import { PipedreamClient } from "@pipedream/sdk"
import { getPipedreamProjectEnvironment } from "@/lib/pipedream-connect-env"

function getClient(): PipedreamClient | null {
  const clientId = process.env.PIPEDREAM_CLIENT_ID
  const clientSecret = process.env.PIPEDREAM_CLIENT_SECRET
  const projectId = process.env.PIPEDREAM_PROJECT_ID
  if (!clientId || !clientSecret || !projectId) return null
  return new PipedreamClient({
    clientId,
    clientSecret,
    projectId,
    projectEnvironment: getPipedreamProjectEnvironment(),
  })
}

/** First healthy connected GitHub account for this external user (Connect). Falls back to first account if none are healthy. */
export async function getGithubAccountId(externalUserId: string): Promise<string | null> {
  const client = getClient()
  if (!client) return null
  try {
    const page = await client.accounts.list({
      externalUserId,
      app: "github",
      limit: 10,
    })
    const accounts = page.data ?? []
    // Prefer a healthy, non-dead account over a stale/dead one
    const healthy = accounts.find((a) => !a.dead && a.healthy !== false)
    const fallback = accounts.find((a) => !a.dead)
    const chosen = healthy ?? fallback ?? accounts[0]
    return chosen?.id ?? null
  } catch (e) {
    console.error("[pipedream-github] accounts.list:", e instanceof Error ? e.message : e)
    return null
  }
}

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
} as const

export type GithubRepoListItem = { full_name: string; default_branch: string; private: boolean }

/** Parse JSON from Pipedream proxy (sometimes string; may be GitHub error object). */
export function parseGithubJson<T>(raw: unknown): { ok: true; data: T } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, data: null as T }
  if (typeof raw === "string") {
    try {
      return parseGithubJson(JSON.parse(raw))
    } catch {
      return { ok: false, error: "Invalid JSON from GitHub proxy" }
    }
  }
  if (Array.isArray(raw)) return { ok: true, data: raw as T }
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.data)) return { ok: true, data: o.data as T }
    /** GraphQL: errors with no data */
    if (Array.isArray(o.errors) && o.errors.length > 0 && (o.data === null || o.data === undefined)) {
      const first = o.errors[0] as { message?: string }
      return { ok: false, error: typeof first?.message === "string" ? first.message : "GraphQL error" }
    }
    if (typeof o.message === "string") {
      const looksLikeGithubError =
        o.documentation_url != null ||
        o.status != null ||
        Array.isArray(o.errors) ||
        o.message === "Bad credentials" ||
        o.message === "Not Found"
      if (looksLikeGithubError && typeof o.login !== "string") {
        return { ok: false, error: o.message }
      }
    }
  }
  return { ok: true, data: raw as T }
}

type RawRepo = { full_name?: string; default_branch?: string; private?: boolean }

/** Normalize REST/GraphQL payloads into a repo array (Pipedream sometimes wraps bodies). */
function extractRepoArrayFromPayload(raw: unknown): RawRepo[] {
  if (raw === null || raw === undefined) return []
  if (Array.isArray(raw)) return raw as RawRepo[]
  if (typeof raw === "string") {
    try {
      return extractRepoArrayFromPayload(JSON.parse(raw))
    } catch {
      return []
    }
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.data)) return o.data as RawRepo[]
    if (typeof o.body === "string") return extractRepoArrayFromPayload(o.body)
    const nested = o.data
    if (nested && typeof nested === "object") {
      const d = nested as Record<string, unknown>
      if (Array.isArray(d.data)) return d.data as RawRepo[]
    }
  }
  return []
}

function mapRawRepos(arr: RawRepo[]): GithubRepoListItem[] {
  return arr
    .filter((x) => x && typeof x.full_name === "string")
    .map((r) => ({
      full_name: r.full_name as string,
      default_branch: typeof r.default_branch === "string" ? r.default_branch : "main",
      private: Boolean(r.private),
    }))
}

function parseGraphqlRepoList(raw: unknown): GithubRepoListItem[] {
  const o = raw as Record<string, unknown> | null
  if (!o || typeof o !== "object") return []
  const data = o.data as Record<string, unknown> | undefined
  const viewer = data?.viewer as Record<string, unknown> | undefined
  const repos = viewer?.repositories as Record<string, unknown> | undefined
  const nodes = repos?.nodes as unknown
  if (!Array.isArray(nodes)) return []
  const out: GithubRepoListItem[] = []
  for (const n of nodes) {
    if (!n || typeof n !== "object") continue
    const node = n as Record<string, unknown>
    const nameWithOwner = node.nameWithOwner
    if (typeof nameWithOwner !== "string" || !nameWithOwner.includes("/")) continue
    const branchRef = node.defaultBranchRef as Record<string, unknown> | undefined
    const branchName = typeof branchRef?.name === "string" ? branchRef.name : "main"
    out.push({
      full_name: nameWithOwner,
      default_branch: branchName,
      private: Boolean(node.isPrivate),
    })
  }
  return out
}

export async function githubProxyGetJsonResult<T>(
  externalUserId: string,
  accountId: string,
  url: string,
  timeoutMs = 20_000,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const client = getClient()
  if (!client) return { ok: false, error: "Pipedream is not configured" }
  try {
    const sdkCall = client.proxy
      .get({ url, externalUserId, accountId, headers: GITHUB_HEADERS })
      .withRawResponse()
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Pipedream proxy timed out after ${timeoutMs}ms`)), timeoutMs),
    )
    const wr = await Promise.race([sdkCall, timeout])
    return parseGithubJson<T>(wr.data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[pipedream-github] proxy.get", url, msg)
    return { ok: false, error: msg }
  }
}

export async function githubProxyPostJsonResult<T>(
  externalUserId: string,
  accountId: string,
  url: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const client = getClient()
  if (!client) return { ok: false, error: "Pipedream is not configured" }
  try {
    const wr = await client.proxy
      .post({
        url,
        externalUserId,
        accountId,
        body,
        headers: {
          ...GITHUB_HEADERS,
          "Content-Type": "application/json",
        },
      })
      .withRawResponse()
    return parseGithubJson<T>(wr.data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[pipedream-github] proxy.post", url, msg)
    return { ok: false, error: msg }
  }
}

const GITHUB_GRAPHQL_REPOS = `query RepoList($first: Int!) {
  viewer {
    repositories(
      first: $first
      ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
      orderBy: { field: UPDATED_AT, direction: DESC }
    ) {
      nodes {
        nameWithOwner
        isPrivate
        defaultBranchRef { name }
      }
    }
  }
}`

/**
 * List repos for one Connect account.
 * Uses a few parallel REST calls (page 1 only) + optional page 2 + GraphQL — avoids dozens of
 * sequential requests that time out on Vercel (maxDuration) and leave the UI stuck on "loading".
 */
export async function githubProxyListUserRepos(
  externalUserId: string,
  accountId: string,
): Promise<{ repos: GithubRepoListItem[]; fetchError?: string }> {
  const urlsFirstPage = [
    "https://api.github.com/user/repos?per_page=100&sort=updated&visibility=all",
    "https://api.github.com/user/repos?per_page=100&sort=updated",
    "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
  ]
  let lastError: string | undefined

  const fetchPage = async (url: string): Promise<{ repos: GithubRepoListItem[]; err?: string }> => {
    const r = await githubProxyGetJsonResult<unknown>(externalUserId, accountId, url)
    if (!r.ok) return { repos: [], err: r.error }
    const arr = extractRepoArrayFromPayload(r.data)
    return { repos: mapRawRepos(arr) }
  }

  const parallelFirst = await Promise.all(urlsFirstPage.map((u) => fetchPage(u)))
  const merged = new Map<string, GithubRepoListItem>()
  for (const part of parallelFirst) {
    if (part.err) lastError = part.err
    for (const repo of part.repos) merged.set(repo.full_name, repo)
  }
  if (merged.size > 0) {
    return { repos: Array.from(merged.values()).sort((a, b) => a.full_name.localeCompare(b.full_name)) }
  }

  const page2Url = `${urlsFirstPage[0]}&page=2`
  const p2 = await fetchPage(page2Url)
  if (p2.err) lastError = p2.err
  for (const repo of p2.repos) merged.set(repo.full_name, repo)
  if (merged.size > 0) {
    return { repos: Array.from(merged.values()).sort((a, b) => a.full_name.localeCompare(b.full_name)) }
  }

  const gql = await githubProxyPostJsonResult<unknown>(externalUserId, accountId, "https://api.github.com/graphql", {
    query: GITHUB_GRAPHQL_REPOS,
    variables: { first: 100 },
  })
  if (gql.ok) {
    const fromGql = parseGraphqlRepoList(gql.data)
    if (fromGql.length > 0) return { repos: fromGql.sort((a, b) => a.full_name.localeCompare(b.full_name)) }
  } else {
    lastError = gql.error
  }

  return { repos: [], fetchError: lastError }
}

/**
 * List repos using every non-dead GitHub Connect account, merging unique repos by full_name.
 * Fixes empty dropdowns when the first account is stale but another connection still works.
 */
function looksLikeGithubLogin(s: string): boolean {
  const t = s.trim()
  return t.length > 0 && t.length <= 39 && /^[a-zA-Z0-9]([a-zA-Z0-9]|-(?=[a-zA-Z0-9]))*$/.test(t)
}

export async function githubProxyListUserReposMerged(
  externalUserId: string,
): Promise<{
  repos: GithubRepoListItem[]
  fetchError?: string
  /** Distinct GitHub/proxy error strings from accounts that returned no repos (for debugging). */
  repoListErrors: string[]
  githubLogin: string | null
  accountIdsTried: number
}> {
  const client = getClient()
  if (!client) {
    return {
      repos: [],
      githubLogin: null,
      accountIdsTried: 0,
      fetchError: "Pipedream is not configured",
      repoListErrors: [],
    }
  }

  let page
  try {
    page = await client.accounts.list({
      externalUserId,
      app: "github",
      limit: 50,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[pipedream-github] accounts.list (merged repos):", msg)
    return { repos: [], githubLogin: null, accountIdsTried: 0, fetchError: msg, repoListErrors: [] }
  }

  const rawAccounts = page.data ?? []
  // Sort: healthy + non-dead first, then by most recently updated
  const sorted = [...rawAccounts].sort((a, b) => {
    const aScore = (a.dead ? 0 : 1) * 2 + (a.healthy === false ? 0 : 1)
    const bScore = (b.dead ? 0 : 1) * 2 + (b.healthy === false ? 0 : 1)
    if (bScore !== aScore) return bScore - aScore
    const aT = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0
    const bT = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0
    return bT - aT
  })
  // Deduplicate by GitHub identity (name) — keep the best-ranked per identity, cap at 3
  const seenIdentity = new Set<string>()
  const accounts = sorted.filter((a) => {
    const key = a.name?.trim().toLowerCase() || `__id_${a.id}`
    if (seenIdentity.has(key)) return false
    seenIdentity.add(key)
    return true
  }).slice(0, 3)

  if (accounts.length === 0) {
    return { repos: [], githubLogin: null, accountIdsTried: 0, repoListErrors: [] }
  }

  const parallel = await Promise.allSettled(
    accounts.map(async (acc) => {
      const [listRes, userRes] = await Promise.all([
        githubProxyListUserRepos(externalUserId, acc.id),
        githubProxyGetJsonResult<{ login?: string }>(
          externalUserId,
          acc.id,
          "https://api.github.com/user",
        ),
      ])
      return { acc, listRes, userRes }
    }),
  )

  const byName = new Map<string, GithubRepoListItem>()
  let lastListError: string | undefined
  let githubLogin: string | null = null
  const repoListErrors: string[] = []

  for (const settled of parallel) {
    if (settled.status === "rejected") {
      const msg = settled.reason instanceof Error ? settled.reason.message : String(settled.reason)
      repoListErrors.push(msg)
      lastListError = msg
      continue
    }
    const { acc, listRes, userRes } = settled.value
    if (listRes.fetchError) {
      lastListError = listRes.fetchError
      repoListErrors.push(listRes.fetchError)
    }
    for (const r of listRes.repos) {
      byName.set(r.full_name, r)
    }
    if (
      !githubLogin &&
      userRes.ok &&
      userRes.data &&
      typeof (userRes.data as { login?: string }).login === "string"
    ) {
      githubLogin = (userRes.data as { login: string }).login
    }
    if (!githubLogin && acc.name && looksLikeGithubLogin(acc.name)) {
      githubLogin = acc.name.trim()
    }
  }

  const repos = Array.from(byName.values()).sort((a, b) => a.full_name.localeCompare(b.full_name))
  const uniqueErrors = [...new Set(repoListErrors)]
  return {
    repos,
    githubLogin,
    accountIdsTried: accounts.length,
    fetchError: repos.length === 0 ? lastListError : undefined,
    repoListErrors: repos.length === 0 ? uniqueErrors : [],
  }
}

export async function githubProxyGetJson<T>(
  externalUserId: string,
  accountId: string,
  url: string,
): Promise<T | null> {
  const r = await githubProxyGetJsonResult<T>(externalUserId, accountId, url)
  if (!r.ok) return null
  return r.data
}

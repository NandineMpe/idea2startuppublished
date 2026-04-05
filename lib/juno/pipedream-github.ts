import type { Account } from "@pipedream/sdk"
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

/** Prefer createdAt; fallback updatedAt so older API rows still sort sensibly. */
function accountCreatedMs(a: Account): number {
  const t = a.createdAt ?? a.updatedAt
  if (t instanceof Date) return t.getTime()
  if (typeof t === "string") {
    const ms = Date.parse(t)
    return Number.isNaN(ms) ? 0 : ms
  }
  return 0
}

/**
 * Picks the **most recently created** GitHub Connect account when Pipedream returns multiple rows.
 * Sort: `createdAt` descending; tie-breaker `updatedAt` descending.
 */
export function pickMostRecentGithubAccount(accounts: Account[]): Account | null {
  if (accounts.length === 0) return null
  const sorted = [...accounts].sort((a, b) => {
    const dc = accountCreatedMs(b) - accountCreatedMs(a)
    if (dc !== 0) return dc
    const ua = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0
    const ub = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0
    return ub - ua
  })
  return sorted[0] ?? null
}

export function pickMostRecentGithubAccountId(accounts: Account[]): string | null {
  return pickMostRecentGithubAccount(accounts)?.id ?? null
}

export const GITHUB_ACCOUNTS_LIST_LIMIT = 100

/** Most recently created GitHub Connect account for this external user. */
export async function getGithubAccountId(externalUserId: string): Promise<string | null> {
  const client = getClient()
  if (!client) return null
  try {
    const page = await client.accounts.list({
      externalUserId,
      app: "github",
      limit: GITHUB_ACCOUNTS_LIST_LIMIT,
    })
    return pickMostRecentGithubAccountId(page.data ?? [])
  } catch (e) {
    console.error("[pipedream-github] accounts.list:", e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * Same as {@link getGithubAccountId} but logs the raw Connect account list for Inngest / Vercel logs.
 */
export async function resolveGithubAccountForSecurityScan(userId: string): Promise<string | null> {
  const client = getClient()
  if (!client) {
    console.log("[Security Scan] Pipedream accounts for user:", userId, JSON.stringify([]))
    return null
  }
  try {
    const page = await client.accounts.list({
      externalUserId: userId,
      app: "github",
      limit: GITHUB_ACCOUNTS_LIST_LIMIT,
    })
    const accounts = page.data ?? []
    let accountsJson: string
    try {
      accountsJson = JSON.stringify(accounts)
    } catch {
      accountsJson = JSON.stringify(
        accounts.map((a) => ({ id: a.id, name: a.name, dead: a.dead, healthy: a.healthy })),
      )
    }
    console.log("[Security Scan] Pipedream accounts for user:", userId, accountsJson)
    const selectedId = pickMostRecentGithubAccountId(accounts)
    console.log(
      "[Security Scan] Selected GitHub Connect account:",
      selectedId ?? "none",
      "| total accounts:",
      accounts.length,
    )
    return selectedId
  } catch (e) {
    console.error("[pipedream-github] accounts.list:", e instanceof Error ? e.message : e)
    console.log("[Security Scan] Pipedream accounts for user:", userId, JSON.stringify({ error: String(e) }))
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Pipedream proxy or GitHub edge sometimes returns 502/503 HTML; worth retrying. */
function isTransientProxyError(message: string): boolean {
  const u = message.toLowerCase()
  return (
    /\b502\b|\b503\b|\b504\b/.test(u) ||
    u.includes("bad gateway") ||
    u.includes("gateway timeout") ||
    u.includes("service unavailable") ||
    u.includes("timed out") ||
    u.includes("econnreset") ||
    u.includes("socket hang up")
  )
}

/**
 * The Pipedream SDK v2 returns `wr.data` as parsed JSON for object responses,
 * but as a body stream (with `.bytes()`) for array responses. Normalise both.
 */
async function readProxyData(data: unknown): Promise<unknown> {
  if (data === null || data === undefined) return data
  // Body stream shape — SDK wraps array payloads in a Response-like object
  if (
    typeof data === "object" &&
    !Array.isArray(data) &&
    typeof (data as Record<string, unknown>).bytes === "function"
  ) {
    try {
      const buf = await (data as { bytes: () => Promise<Uint8Array> }).bytes()
      const text = Buffer.from(buf).toString("utf-8")
      return JSON.parse(text)
    } catch {
      return data
    }
  }
  return data
}

async function githubProxyGetJsonResultOnce<T>(
  externalUserId: string,
  accountId: string,
  url: string,
  timeoutMs: number,
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
    const resolved = await readProxyData(wr.data)
    return parseGithubJson<T>(resolved)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[pipedream-github] proxy.get", url, msg)
    return { ok: false, error: msg }
  }
}

const PROXY_GET_RETRIES = 3

export async function githubProxyGetJsonResult<T>(
  externalUserId: string,
  accountId: string,
  url: string,
  timeoutMs = 20_000,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let last: { ok: true; data: T } | { ok: false; error: string } | null = null
  for (let attempt = 1; attempt <= PROXY_GET_RETRIES; attempt++) {
    const r = await githubProxyGetJsonResultOnce<T>(externalUserId, accountId, url, timeoutMs)
    if (r.ok) return r
    last = r
    if (attempt < PROXY_GET_RETRIES && isTransientProxyError(r.error)) {
      await sleep(400 * attempt * attempt)
      continue
    }
    return r
  }
  return last ?? { ok: false, error: "Unknown proxy error" }
}

async function githubProxyPostJsonResultOnce<T>(
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
    const resolved = await readProxyData(wr.data)
    return parseGithubJson<T>(resolved)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[pipedream-github] proxy.post", url, msg)
    return { ok: false, error: msg }
  }
}

export async function githubProxyPostJsonResult<T>(
  externalUserId: string,
  accountId: string,
  url: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let last: { ok: true; data: T } | { ok: false; error: string } | null = null
  for (let attempt = 1; attempt <= PROXY_GET_RETRIES; attempt++) {
    const r = await githubProxyPostJsonResultOnce<T>(externalUserId, accountId, url, body)
    if (r.ok) return r
    last = r
    if (attempt < PROXY_GET_RETRIES && isTransientProxyError(r.error)) {
      await sleep(400 * attempt * attempt)
      continue
    }
    return r
  }
  return last ?? { ok: false, error: "Unknown proxy error" }
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

function looksLikeGithubLogin(s: string): boolean {
  const t = s.trim()
  return t.length > 0 && t.length <= 39 && /^[a-zA-Z0-9]([a-zA-Z0-9]|-(?=[a-zA-Z0-9]))*$/.test(t)
}

/**
 * Lists repos for the **latest** GitHub Connect account only (newest `createdAt`).
 */
export async function githubProxyListUserReposForLatestAccount(
  externalUserId: string,
): Promise<{
  repos: GithubRepoListItem[]
  fetchError?: string
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
      limit: GITHUB_ACCOUNTS_LIST_LIMIT,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[pipedream-github] accounts.list (repos for latest):", msg)
    return { repos: [], githubLogin: null, accountIdsTried: 0, fetchError: msg, repoListErrors: [] }
  }

  const latest = pickMostRecentGithubAccount(page.data ?? [])
  if (!latest) {
    return { repos: [], githubLogin: null, accountIdsTried: 0, repoListErrors: [] }
  }

  const listRes = await githubProxyListUserRepos(externalUserId, latest.id)
  const userRes = await githubProxyGetJsonResult<{ login?: string }>(
    externalUserId,
    latest.id,
    "https://api.github.com/user",
  )

  let githubLogin: string | null = null
  if (
    userRes.ok &&
    userRes.data &&
    typeof (userRes.data as { login?: string }).login === "string"
  ) {
    githubLogin = (userRes.data as { login: string }).login
  }
  if (!githubLogin && latest.name && looksLikeGithubLogin(latest.name)) {
    githubLogin = latest.name.trim()
  }

  const repos = listRes.repos.sort((a, b) => a.full_name.localeCompare(b.full_name))
  const repoListErrors = listRes.fetchError ? [listRes.fetchError] : []

  return {
    repos,
    githubLogin,
    accountIdsTried: 1,
    fetchError: repos.length === 0 ? listRes.fetchError : undefined,
    repoListErrors: repos.length === 0 ? repoListErrors : [],
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

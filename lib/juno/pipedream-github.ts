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

export async function githubProxyGetJsonResult<T>(
  externalUserId: string,
  accountId: string,
  url: string,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const client = getClient()
  if (!client) return { ok: false, error: "Pipedream is not configured" }
  try {
    const wr = await client.proxy
      .get({
        url,
        externalUserId,
        accountId,
        headers: GITHUB_HEADERS,
      })
      .withRawResponse()
    return parseGithubJson<T>(wr.data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[pipedream-github] proxy.get", url, msg)
    return { ok: false, error: msg }
  }
}

export type GithubRepoListItem = { full_name: string; default_branch: string; private: boolean }

/** List repos for the Connect account; tries URLs that work with different proxy/query encodings. */
export async function githubProxyListUserRepos(
  externalUserId: string,
  accountId: string,
): Promise<{ repos: GithubRepoListItem[]; fetchError?: string }> {
  type RawRepo = { full_name?: string; default_branch?: string; private?: boolean }
  const urls = [
    "https://api.github.com/user/repos?per_page=100&sort=updated&visibility=all",
    "https://api.github.com/user/repos?per_page=100&sort=updated",
    "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
  ]
  let lastError: string | undefined
  for (const url of urls) {
    const r = await githubProxyGetJsonResult<unknown>(externalUserId, accountId, url)
    if (!r.ok) {
      lastError = r.error
      continue
    }
    lastError = undefined
    const raw = r.data
    let arr: RawRepo[] = []
    if (Array.isArray(raw)) arr = raw as RawRepo[]
    else if (raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).data)) {
      arr = (raw as { data: RawRepo[] }).data
    }
    const repos: GithubRepoListItem[] = arr
      .filter((x) => x && typeof x.full_name === "string")
      .map((r) => ({
        full_name: r.full_name as string,
        default_branch: typeof r.default_branch === "string" ? r.default_branch : "main",
        private: Boolean(r.private),
      }))
    if (repos.length > 0) return { repos }
  }
  return { repos: [], fetchError: lastError }
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

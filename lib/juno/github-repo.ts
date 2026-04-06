export type GithubRepoListItem = { full_name: string; default_branch: string; private: boolean }

export type RepoTreeEntry = { path: string; size: number; type: string }

/** Server-only classic PAT with `repo` scope for GitHub REST calls. */
function githubPat(): string | null {
  const t = process.env.GITHUB_PAT?.trim()
  return t || null
}

const GITHUB_REST_HEADERS_BASE = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "idea2startup-security-scan",
} as const

async function githubDirectGetJsonResult<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const pat = githubPat()
  if (!pat) return { ok: false, error: "GITHUB_PAT not set" }
  try {
    const res = await fetch(url, {
      headers: {
        ...GITHUB_REST_HEADERS_BASE,
        Authorization: `token ${pat}`,
      },
    })
    const text = await res.text()
    let raw: unknown
    try {
      raw = text ? JSON.parse(text) : null
    } catch {
      return { ok: false, error: `Invalid JSON from GitHub (${res.status})` }
    }
    if (!res.ok) {
      const o = raw as { message?: string } | null
      const msg =
        typeof o?.message === "string"
          ? o.message
          : `HTTP ${res.status}`
      return { ok: false, error: msg }
    }
    return { ok: true, data: raw as T }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function githubDirectGetJson<T>(url: string): Promise<T | null> {
  const r = await githubDirectGetJsonResult<T>(url)
  return r.ok ? r.data : null
}

/** Lists repos via `GITHUB_PAT` (direct GitHub API). */
export async function listUserReposViaPat(): Promise<{
  repos: GithubRepoListItem[]
  error?: string
}> {
  const pat = githubPat()
  if (!pat) return { repos: [] }
  const url =
    "https://api.github.com/user/repos?per_page=100&sort=updated&visibility=all&affiliation=owner,collaborator,organization_member"
  const r = await githubDirectGetJsonResult<Array<Record<string, unknown>>>(url)
  if (!r.ok) return { repos: [], error: r.error }
  const arr = Array.isArray(r.data) ? r.data : []
  const repos: GithubRepoListItem[] = []
  for (const x of arr) {
    if (typeof x.full_name !== "string") continue
    repos.push({
      full_name: x.full_name,
      default_branch: typeof x.default_branch === "string" ? x.default_branch : "main",
      private: Boolean(x.private),
    })
  }
  return {
    repos: repos.sort((a, b) => a.full_name.localeCompare(b.full_name)),
  }
}

async function githubDirectGetRawText(url: string): Promise<string | null> {
  const pat = githubPat()
  if (!pat) return null
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.raw+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "idea2startup-security-scan",
        Authorization: `token ${pat}`,
      },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export function splitGithubRepo(full: string): { owner: string; name: string } | null {
  const parts = full.split("/").filter(Boolean)
  if (parts.length < 2) return null
  return { owner: parts[0], name: parts.slice(1).join("/") }
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/")
}

export async function getRepoTree(
  externalUserId: string,
  accountId: string,
  repoFull: string,
  branch: string,
): Promise<RepoTreeEntry[]> {
  const { entries } = await getRepoTreeWithDiagnostics(externalUserId, accountId, repoFull, branch)
  return entries
}

export function treeEntriesFromGithubTreeRaw(
  raw: Array<{ path?: string; size?: number; type?: string }>,
  repoFull: string,
  branch: string,
): { entries: RepoTreeEntry[]; diagnostic?: string } {
  const out: RepoTreeEntry[] = []
  for (const t of raw) {
    if (t.type !== "blob" || !t.path) continue
    out.push({
      path: t.path,
      size: typeof t.size === "number" ? t.size : 0,
      type: t.type,
    })
  }
  if (out.length === 0 && raw.length > 0) {
    return {
      entries: [],
      diagnostic: `Repository tree loaded but contains no files (only directories). ${repoFull}@${branch}`,
    }
  }
  if (out.length === 0) {
    return {
      entries: [],
      diagnostic: `Empty tree for ${repoFull}@${branch}. Confirm the repo exists and is not empty.`,
    }
  }
  return { entries: out }
}

const NO_PAT_DIAGNOSTIC =
  'Set GITHUB_PAT on the server (classic token with repo scope) so Juno can read this repository.'

export async function getRepoTreeWithDiagnostics(
  _externalUserId: string,
  _accountId: string,
  repoFull: string,
  branch: string,
): Promise<{ entries: RepoTreeEntry[]; diagnostic?: string }> {
  const parsed = splitGithubRepo(repoFull)
  if (!parsed) {
    return {
      entries: [],
      diagnostic: `Invalid repository "${repoFull}" — use owner/repo (one slash).`,
    }
  }
  if (!githubPat()) {
    return { entries: [], diagnostic: NO_PAT_DIAGNOSTIC }
  }
  const { owner, name } = parsed
  const base = `https://api.github.com/repos/${owner}/${name}`

  const refUrl = `${base}/git/ref/heads/${encodeURIComponent(branch)}`
  const refRes = await githubDirectGetJsonResult<{ object?: { sha?: string }; message?: string }>(refUrl)
  if (!refRes.ok) {
    return {
      entries: [],
      diagnostic: `Cannot resolve branch "${branch}" for ${repoFull}: ${refRes.error}. Check the default branch name (main vs master) and that GITHUB_PAT can access the repo.`,
    }
  }
  const commitSha = refRes.data?.object?.sha
  if (!commitSha) {
    return {
      entries: [],
      diagnostic: `Branch "${branch}" has no commit SHA for ${repoFull}. Try another branch name.`,
    }
  }
  const commitRes = await githubDirectGetJsonResult<{ tree?: { sha?: string }; message?: string }>(
    `${base}/git/commits/${commitSha}`,
  )
  if (!commitRes.ok) {
    return {
      entries: [],
      diagnostic: `Could not load commit for ${repoFull}@${branch}: ${commitRes.error}`,
    }
  }
  const treeSha = commitRes.data?.tree?.sha
  if (!treeSha) {
    return { entries: [], diagnostic: `Commit metadata missing tree for ${repoFull}@${branch}.` }
  }
  const treeRes = await githubDirectGetJsonResult<{
    tree?: Array<{ path?: string; size?: number; type?: string }>
    truncated?: boolean
    message?: string
  }>(`${base}/git/trees/${treeSha}?recursive=1`)
  if (!treeRes.ok) {
    return { entries: [], diagnostic: `Could not load file tree: ${treeRes.error}` }
  }
  const raw = treeRes.data?.tree ?? []
  return treeEntriesFromGithubTreeRaw(raw, repoFull, branch)
}

type ContentsFile = {
  content?: string
  encoding?: string
  message?: string
}

export async function readRepoFile(
  _externalUserId: string,
  _accountId: string,
  repoFull: string,
  path: string,
  branch: string,
): Promise<string | null> {
  if (!githubPat()) return null
  const parsed = splitGithubRepo(repoFull)
  if (!parsed) return null
  const { owner, name } = parsed
  const base = `https://api.github.com/repos/${owner}/${name}`
  const url = `${base}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`
  const raw = await githubDirectGetRawText(url)
  if (raw !== null) return raw
  const res = await githubDirectGetJson<ContentsFile | ContentsFile[]>(url)
  if (!res) return null
  if (Array.isArray(res)) return null
  if (res.encoding === "base64" && typeof res.content === "string") {
    const buf = Buffer.from(res.content.replace(/\s/g, ""), "base64")
    return buf.toString("utf8")
  }
  return null
}

type CommitListItem = { sha: string; commit?: { message?: string; author?: { date?: string } } }
type CommitDetail = {
  sha: string
  commit?: { message?: string; author?: { date?: string } }
  files?: Array<{ filename?: string }>
}

export async function getRecentCommits(
  _externalUserId: string,
  _accountId: string,
  repoFull: string,
  branch: string,
  days: number,
): Promise<Array<{ sha: string; message: string; date: string; files: string[] }>> {
  if (!githubPat()) return []
  const parsed = splitGithubRepo(repoFull)
  if (!parsed) return []
  const { owner, name } = parsed
  const base = `https://api.github.com/repos/${owner}/${name}`
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const listUrl = `${base}/commits?sha=${encodeURIComponent(branch)}&since=${encodeURIComponent(since)}&per_page=30`

  const list = await githubDirectGetJson<CommitListItem[]>(listUrl)
  if (!Array.isArray(list) || list.length === 0) return []

  const limited = list.slice(0, 20)
  const batchSize = 5
  const out: Array<{ sha: string; message: string; date: string; files: string[] }> = []

  for (let i = 0; i < limited.length; i += batchSize) {
    const batch = limited.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (c) => {
        const sha = c.sha
        if (!sha) return null
        const detail = await githubDirectGetJson<CommitDetail>(`${base}/commits/${sha}`)
        const files = (detail?.files ?? []).map((f) => f.filename).filter((x): x is string => Boolean(x))
        return {
          sha,
          message: detail?.commit?.message ?? c.commit?.message ?? "",
          date: detail?.commit?.author?.date ?? c.commit?.author?.date ?? "",
          files,
        }
      }),
    )
    for (const row of batchResults) {
      if (row) out.push(row)
    }
  }

  return out
}

/**
 * Read an Obsidian vault mirrored to GitHub as markdown files.
 * Uses GitHub REST API (tree + blobs). Works with private repos when GITHUB_VAULT_TOKEN is set.
 *
 * @see docs/obsidian-github-vault.md
 */

export type GithubVaultConfig = {
  owner: string
  repo: string
  branch?: string
  /** Optional prefix, e.g. "notes" or "vault/" — slashes normalized */
  pathPrefix?: string
  /**
   * Optional override for fetching JSON from GitHub API.
   * When provided (e.g. via Pipedream proxy for private repos),
   * used instead of direct fetch + server token.
   */
  fetchJson?: (url: string) => Promise<unknown>
}

export type VaultFile = {
  path: string
  content: string
}

export function splitGithubRepoRef(repoRef: string | null | undefined): { owner: string; repo: string } | null {
  const stripped = (repoRef?.trim() ?? "")
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "")
  const parts = stripped.split("/").filter(Boolean)
  if (parts.length !== 2) return null
  return { owner: parts[0], repo: parts[1] }
}

export function resolveGithubVaultRepoParts(row: Record<string, unknown>): {
  owner: string
  repo: string
  repoRef: string
} | null {
  const repoField = (row.github_vault_repo as string | undefined)?.trim()
  const direct = splitGithubRepoRef(repoField)
  if (direct) {
    return {
      owner: direct.owner,
      repo: direct.repo,
      repoRef: `${direct.owner}/${direct.repo}`,
    }
  }

  const owner = (row.github_vault_owner as string | undefined)?.trim()
  const repo = repoField?.replace(/^\/+|\/+$/g, "")
  if (!owner || !repo) return null

  return {
    owner,
    repo,
    repoRef: `${owner}/${repo}`,
  }
}

const GITHUB_API = "https://api.github.com"

function decodeBase64Utf8(b64: string): string {
  const clean = b64.replace(/\s/g, "")
  if (typeof Buffer !== "undefined") {
    return Buffer.from(clean, "base64").toString("utf8")
  }
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function getToken(): string | undefined {
  return (
    process.env.GITHUB_VAULT_TOKEN?.trim()
    || process.env.GITHUB_TOKEN?.trim()
    || process.env.GITHUB_PAT?.trim()
    || undefined
  )
}

function headers(token?: string): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (token) {
    h.Authorization = process.env.GITHUB_PAT?.trim() === token ? `token ${token}` : `Bearer ${token}`
  }
  return h
}

async function getRepoMetadata(
  base: string,
  token?: string,
): Promise<{ found: boolean; defaultBranch?: string }> {
  try {
    const res = await fetch(base, { headers: headers(token) })
    if (!res.ok) return { found: false }
    const json = (await res.json()) as { default_branch?: string }
    return {
      found: true,
      defaultBranch: typeof json.default_branch === "string" ? json.default_branch : undefined,
    }
  } catch {
    return { found: false }
  }
}

async function describeRepoOrBranchError(
  base: string,
  token: string | undefined,
  owner: string,
  repo: string,
  branch: string,
): Promise<string> {
  const meta = await getRepoMetadata(base, token)
  if (meta.found) {
    if (meta.defaultBranch && meta.defaultBranch !== branch) {
      return `Branch "${branch}" not found for ${owner}/${repo}. Try "${meta.defaultBranch}" instead.`
    }
    return `Branch "${branch}" not found for ${owner}/${repo}.`
  }

  return token
    ? `Repo "${owner}/${repo}" was not found, or the configured server token cannot access it.`
    : `Repo "${owner}/${repo}" was not found. For a private vault, connect GitHub or set a server GitHub token.`
}

function normalizePrefix(prefix: string | undefined): string {
  if (!prefix?.trim()) return ""
  let p = prefix.trim().replace(/\\/g, "/")
  if (p.startsWith("/")) p = p.slice(1)
  if (p.length > 0 && !p.endsWith("/")) p += "/"
  return p
}

function shouldSkipPath(path: string): boolean {
  const lower = path.toLowerCase()
  if (lower.includes("/.obsidian/") || lower.startsWith(".obsidian/")) return true
  if (lower.includes("/node_modules/") || lower.startsWith("node_modules/")) return true
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif"))
    return true
  return false
}

/**
 * Fetch all .md files from the repo (recursive tree), optionally under pathPrefix.
 * Respects maxFiles / maxTotalChars for LLM context limits.
 */
/** Fetch JSON from GitHub using either the Pipedream proxy or a direct token-authenticated request. */
async function githubGet<T>(url: string, token: string | undefined, fetchJson?: (url: string) => Promise<unknown>): Promise<{ ok: true; data: T } | { ok: false; status?: number; error: string }> {
  if (fetchJson) {
    try {
      const data = await fetchJson(url)
      return { ok: true, data: data as T }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Proxy fetch failed" }
    }
  }
  const res = await fetch(url, { headers: headers(token) })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return { ok: false, status: res.status, error: `GitHub ${res.status}: ${text.slice(0, 200)}` }
  }
  return { ok: true, data: (await res.json()) as T }
}

export async function fetchGithubVaultMarkdown(
  config: GithubVaultConfig,
  options: {
    maxFiles?: number
    maxTotalChars?: number
    maxPerFileChars?: number
  } = {},
): Promise<{ files: VaultFile[]; error?: string }> {
  const maxFiles = options.maxFiles ?? 40
  const maxTotalChars = options.maxTotalChars ?? 72_000
  const maxPerFileChars = options.maxPerFileChars ?? 14_000

  const owner = config.owner?.trim()
  const repo = config.repo?.trim()
  const branch = config.branch?.trim() || "main"
  const prefix = normalizePrefix(config.pathPrefix)
  const { fetchJson } = config

  if (!owner || !repo) {
    return { files: [], error: "owner and repo are required" }
  }

  const token = fetchJson ? undefined : getToken()
  const base = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

  try {
    const branchResult = await githubGet<{ commit?: { sha?: string } }>(
      `${base}/branches/${encodeURIComponent(branch)}`, token, fetchJson,
    )
    if (!branchResult.ok) {
      if (branchResult.status === 404 || branchResult.error.includes("404") || branchResult.error.includes("Not Found")) {
        return { files: [], error: await describeRepoOrBranchError(base, token, owner, repo, branch) }
      }
      return { files: [], error: branchResult.error }
    }

    const commitSha = branchResult.data.commit?.sha
    if (!commitSha) return { files: [], error: "Could not resolve branch commit" }

    const commitResult = await githubGet<{ tree?: { sha?: string } }>(
      `${base}/git/commits/${commitSha}`, token, fetchJson,
    )
    if (!commitResult.ok) return { files: [], error: `GitHub commit: ${commitResult.error}` }

    const treeSha = commitResult.data.tree?.sha
    if (!treeSha) return { files: [], error: "Could not resolve git tree" }

    const treeResult = await githubGet<{
      tree?: Array<{ path?: string; type?: string; sha?: string; size?: number }>
      truncated?: boolean
    }>(`${base}/git/trees/${treeSha}?recursive=1`, token, fetchJson)
    if (!treeResult.ok) return { files: [], error: `GitHub tree: ${treeResult.error}` }

    const treeData = treeResult.data
    if (treeData.truncated) {
      console.warn("[github-vault] GitHub tree response was truncated; increase file limits or narrow path prefix.")
    }

    const entries = (treeData.tree ?? []).filter((t) => {
      if (t.type !== "blob" || !t.path || !t.sha) return false
      if (!t.path.toLowerCase().endsWith(".md")) return false
      if (shouldSkipPath(t.path)) return false
      if (prefix && !t.path.startsWith(prefix)) return false
      return true
    })

    const sorted = [...entries].sort((a, b) => (a.path ?? "").localeCompare(b.path ?? ""))

    const files: VaultFile[] = []
    let totalChars = 0

    for (const entry of sorted) {
      if (files.length >= maxFiles || totalChars >= maxTotalChars) break
      const path = entry.path as string
      const blobResult = await githubGet<{ encoding?: string; content?: string }>(
        `${base}/git/blobs/${entry.sha}`, token, fetchJson,
      )
      if (!blobResult.ok) continue
      const blob = blobResult.data
      if (blob.encoding !== "base64" || !blob.content) continue

      let text: string
      try {
        text = decodeBase64Utf8(blob.content)
      } catch {
        continue
      }

      if (text.length > maxPerFileChars) {
        text = text.slice(0, maxPerFileChars) + "\n[...truncated by Juno]"
      }

      const chunk = text.length + path.length + 32
      if (totalChars + chunk > maxTotalChars && files.length > 0) break

      files.push({ path, content: text })
      totalChars += chunk
    }

    return { files }
  } catch (e) {
    console.error("[github-vault] fetch error:", e)
    return { files: [], error: e instanceof Error ? e.message : "Unknown error" }
  }
}

export type GithubVaultPathEntry = { path: string; sha: string; size: number }

/**
 * List `.md` blob paths under the repo (optionally under `folder` as path prefix), without fetching contents.
 */
export async function listGithubVaultMarkdownPaths(
  config: GithubVaultConfig,
  folder?: string,
): Promise<{ entries: GithubVaultPathEntry[]; error?: string }> {
  const owner = config.owner?.trim()
  const repo = config.repo?.trim()
  const branch = config.branch?.trim() || "main"
  const prefix = normalizePrefix(config.pathPrefix)
  const folderPrefix = folder ? normalizePrefix(folder.replace(/^\//, "")) : ""
  const { fetchJson } = config

  if (!owner || !repo) {
    return { entries: [], error: "owner and repo are required" }
  }

  const token = fetchJson ? undefined : getToken()
  const base = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

  try {
    const branchResult = await githubGet<{ commit?: { sha?: string } }>(
      `${base}/branches/${encodeURIComponent(branch)}`, token, fetchJson,
    )
    if (!branchResult.ok) {
      return {
        entries: [],
        error: branchResult.status === 404 || branchResult.error.includes("404") || branchResult.error.includes("Not Found")
          ? await describeRepoOrBranchError(base, token, owner, repo, branch)
          : branchResult.error,
      }
    }

    const commitSha = branchResult.data.commit?.sha
    if (!commitSha) return { entries: [], error: "Could not resolve branch commit" }

    const commitResult = await githubGet<{ tree?: { sha?: string } }>(
      `${base}/git/commits/${commitSha}`, token, fetchJson,
    )
    if (!commitResult.ok) return { entries: [], error: `GitHub commit: ${commitResult.error}` }

    const treeSha = commitResult.data.tree?.sha
    if (!treeSha) return { entries: [], error: "Could not resolve git tree" }

    const treeResult = await githubGet<{
      tree?: Array<{ path?: string; type?: string; sha?: string; size?: number }>
      truncated?: boolean
    }>(`${base}/git/trees/${treeSha}?recursive=1`, token, fetchJson)
    if (!treeResult.ok) return { entries: [], error: `GitHub tree: ${treeResult.error}` }

    const treeData = treeResult.data
    const fullPrefix = prefix + folderPrefix

    const entries = (treeData.tree ?? [])
      .filter((t) => {
        if (t.type !== "blob" || !t.path || !t.sha) return false
        if (!t.path.toLowerCase().endsWith(".md")) return false
        if (shouldSkipPath(t.path)) return false
        if (fullPrefix && !t.path.startsWith(fullPrefix)) return false
        return true
      })
      .map((t) => ({
        path: t.path as string,
        sha: t.sha as string,
        size: typeof t.size === "number" ? t.size : 0,
      }))
      .sort((a, b) => a.path.localeCompare(b.path))

    if (treeData.truncated) {
      console.warn("[github-vault] listGithubVaultMarkdownPaths: tree was truncated")
    }

    return { entries }
  } catch (e) {
    console.error("[github-vault] listGithubVaultMarkdownPaths:", e)
    return { entries: [], error: e instanceof Error ? e.message : "Unknown error" }
  }
}

/**
 * Load vault for company profile row (raw Supabase fields).
 */
export async function fetchGithubVaultFromProfileFields(row: Record<string, unknown>): Promise<{
  files: VaultFile[]
  error?: string
}> {
  const repoParts = resolveGithubVaultRepoParts(row)
  if (!repoParts) {
    return { files: [] }
  }

  const branch = (row.github_vault_branch as string | undefined)?.trim() || "main"
  const pathPrefix = (row.github_vault_path as string | undefined) ?? ""

  return fetchGithubVaultMarkdown({
    owner: repoParts.owner,
    repo: repoParts.repo,
    branch,
    pathPrefix: pathPrefix || undefined,
  })
}

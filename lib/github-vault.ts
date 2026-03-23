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
}

export type VaultFile = {
  path: string
  content: string
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
  return process.env.GITHUB_VAULT_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || undefined
}

function headers(token?: string): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (token) h.Authorization = `Bearer ${token}`
  return h
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

  if (!owner || !repo) {
    return { files: [], error: "owner and repo are required" }
  }

  const token = getToken()

  const base = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

  try {
    const branchRes = await fetch(`${base}/branches/${encodeURIComponent(branch)}`, {
      headers: headers(token),
    })

    if (!branchRes.ok) {
      const errText = await branchRes.text().catch(() => "")
      if (branchRes.status === 404) {
        return {
          files: [],
          error: token
            ? "Repo or branch not found, or token cannot access this repository."
            : "Repo or branch not found. For a private vault, set GITHUB_VAULT_TOKEN on the server.",
        }
      }
      return { files: [], error: `GitHub ${branchRes.status}: ${errText.slice(0, 200)}` }
    }

    const branchJson = (await branchRes.json()) as { commit?: { sha?: string } }
    const commitSha = branchJson.commit?.sha
    if (!commitSha) {
      return { files: [], error: "Could not resolve branch commit" }
    }

    const commitRes = await fetch(`${base}/git/commits/${commitSha}`, { headers: headers(token) })
    if (!commitRes.ok) {
      return { files: [], error: `GitHub commit ${commitRes.status}` }
    }
    const commitData = (await commitRes.json()) as { tree?: { sha?: string } }
    const treeSha = commitData.tree?.sha
    if (!treeSha) {
      return { files: [], error: "Could not resolve git tree" }
    }

    const treeRes = await fetch(`${base}/git/trees/${treeSha}?recursive=1`, { headers: headers(token) })
    if (!treeRes.ok) {
      return { files: [], error: `GitHub tree ${treeRes.status}` }
    }

    const treeData = (await treeRes.json()) as {
      tree?: Array<{ path?: string; type?: string; sha?: string; size?: number }>
      truncated?: boolean
    }

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
      const blobRes = await fetch(`${base}/git/blobs/${entry.sha}`, { headers: headers(token) })
      if (!blobRes.ok) continue

      const blob = (await blobRes.json()) as { encoding?: string; content?: string }
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

  if (!owner || !repo) {
    return { entries: [], error: "owner and repo are required" }
  }

  const token = getToken()
  const base = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

  try {
    const branchRes = await fetch(`${base}/branches/${encodeURIComponent(branch)}`, {
      headers: headers(token),
    })

    if (!branchRes.ok) {
      const errText = await branchRes.text().catch(() => "")
      return {
        entries: [],
        error: branchRes.status === 404 ? "Repo or branch not found" : `GitHub ${branchRes.status}: ${errText.slice(0, 200)}`,
      }
    }

    const branchJson = (await branchRes.json()) as { commit?: { sha?: string } }
    const commitSha = branchJson.commit?.sha
    if (!commitSha) {
      return { entries: [], error: "Could not resolve branch commit" }
    }

    const commitRes = await fetch(`${base}/git/commits/${commitSha}`, { headers: headers(token) })
    if (!commitRes.ok) {
      return { entries: [], error: `GitHub commit ${commitRes.status}` }
    }

    const commitData = (await commitRes.json()) as { tree?: { sha?: string } }
    const treeSha = commitData.tree?.sha
    if (!treeSha) {
      return { entries: [], error: "Could not resolve git tree" }
    }

    const treeRes = await fetch(`${base}/git/trees/${treeSha}?recursive=1`, { headers: headers(token) })
    if (!treeRes.ok) {
      return { entries: [], error: `GitHub tree ${treeRes.status}` }
    }

    const treeData = (await treeRes.json()) as {
      tree?: Array<{ path?: string; type?: string; sha?: string; size?: number }>
      truncated?: boolean
    }

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
  const owner = (row.github_vault_owner as string | undefined)?.trim()
  const repo = (row.github_vault_repo as string | undefined)?.trim()
  if (!owner || !repo) {
    return { files: [] }
  }

  const branch = (row.github_vault_branch as string | undefined)?.trim() || "main"
  const pathPrefix = (row.github_vault_path as string | undefined) ?? ""

  return fetchGithubVaultMarkdown({
    owner,
    repo,
    branch,
    pathPrefix: pathPrefix || undefined,
  })
}

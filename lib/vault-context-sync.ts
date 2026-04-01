import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchGithubVaultMarkdown,
  listGithubVaultMarkdownPaths,
  resolveGithubVaultRepoParts,
  type GithubVaultConfig,
  type VaultFile,
} from "@/lib/github-vault"
import { normalizeVaultFolders } from "@/lib/vault-context-shared"
import { getGithubAccountId, githubProxyGetJsonResult } from "@/lib/juno/pipedream-github"

// ── Pipedream-proxied vault fetch ─────────────────────────────────────────────

function decodeBase64Utf8Sync(b64: string): string {
  const clean = b64.replace(/\s/g, "")
  if (typeof Buffer !== "undefined") return Buffer.from(clean, "base64").toString("utf8")
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function describePipedreamRepoOrBranchError(
  userId: string,
  accountId: string,
  base: string,
  repoRef: string,
  branch: string,
): Promise<string> {
  const repoRes = await githubProxyGetJsonResult<{ default_branch?: string }>(userId, accountId, base)
  if (!repoRes.ok) {
    return `Repo "${repoRef}" was not found, or the connected GitHub account cannot access it.`
  }

  const defaultBranch = typeof repoRes.data?.default_branch === "string" ? repoRes.data.default_branch.trim() : ""
  if (defaultBranch && defaultBranch !== branch) {
    return `Branch "${branch}" not found for ${repoRef}. Try "${defaultBranch}" instead.`
  }

  return `Branch "${branch}" not found for ${repoRef}.`
}

async function fetchVaultViaPipedream(
  userId: string,
  accountId: string,
  config: GithubVaultConfig,
  options: { maxFiles: number; maxTotalChars: number; maxPerFileChars: number; pathPrefix?: string },
): Promise<{ files: VaultFile[]; error?: string }> {
  const owner = config.owner.trim()
  const repo = config.repo.trim()
  const branch = (config.branch?.trim()) || "main"
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

  const folderPrefix = options.pathPrefix
    ? options.pathPrefix.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "") + "/"
    : ""

  // Resolve branch → commit → tree
  const branchRes = await githubProxyGetJsonResult<{ commit?: { sha?: string } }>(
    userId, accountId, `${base}/branches/${encodeURIComponent(branch)}`,
  )
  if (!branchRes.ok) {
    const message = /not found/i.test(branchRes.error)
      ? await describePipedreamRepoOrBranchError(userId, accountId, base, `${owner}/${repo}`, branch)
      : branchRes.error
    return { files: [], error: message }
  }
  const commitSha = branchRes.data?.commit?.sha
  if (!commitSha) return { files: [], error: "Could not resolve branch commit" }

  const commitRes = await githubProxyGetJsonResult<{ tree?: { sha?: string } }>(
    userId, accountId, `${base}/git/commits/${commitSha}`,
  )
  if (!commitRes.ok) return { files: [], error: commitRes.error }
  const treeSha = commitRes.data?.tree?.sha
  if (!treeSha) return { files: [], error: "Could not resolve git tree" }

  const treeRes = await githubProxyGetJsonResult<{
    tree?: Array<{ path?: string; type?: string; sha?: string; size?: number }>
  }>(userId, accountId, `${base}/git/trees/${treeSha}?recursive=1`)
  if (!treeRes.ok) return { files: [], error: treeRes.error }

  const entries = (treeRes.data?.tree ?? []).filter((t) => {
    if (t.type !== "blob" || !t.path || !t.sha) return false
    if (!t.path.toLowerCase().endsWith(".md")) return false
    if (t.path.toLowerCase().includes("/.obsidian/") || t.path.startsWith(".obsidian/")) return false
    if (folderPrefix && !t.path.startsWith(folderPrefix)) return false
    return true
  }).sort((a, b) => (a.path ?? "").localeCompare(b.path ?? ""))

  const files: VaultFile[] = []
  let totalChars = 0

  for (const entry of entries) {
    if (files.length >= options.maxFiles || totalChars >= options.maxTotalChars) break
    const blobRes = await githubProxyGetJsonResult<{ encoding?: string; content?: string }>(
      userId, accountId, `${base}/git/blobs/${entry.sha}`,
    )
    if (!blobRes.ok || blobRes.data?.encoding !== "base64" || !blobRes.data.content) continue
    let content = decodeBase64Utf8Sync(blobRes.data.content)
    if (content.length > options.maxPerFileChars) content = content.slice(0, options.maxPerFileChars)
    files.push({ path: entry.path as string, content })
    totalChars += content.length
  }

  return { files }
}

async function listVaultPathsViaPipedream(
  userId: string,
  accountId: string,
  config: GithubVaultConfig,
  folder?: string,
): Promise<{ entries: { path: string }[]; error?: string }> {
  const owner = config.owner.trim()
  const repo = config.repo.trim()
  const branch = (config.branch?.trim()) || "main"
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  const folderPrefix = folder
    ? folder.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "") + "/"
    : ""

  const branchRes = await githubProxyGetJsonResult<{ commit?: { sha?: string } }>(
    userId, accountId, `${base}/branches/${encodeURIComponent(branch)}`,
  )
  if (!branchRes.ok) {
    const message = /not found/i.test(branchRes.error)
      ? await describePipedreamRepoOrBranchError(userId, accountId, base, `${owner}/${repo}`, branch)
      : branchRes.error
    return { entries: [], error: message }
  }
  const commitSha = branchRes.data?.commit?.sha
  if (!commitSha) return { entries: [], error: "Could not resolve branch commit" }

  const commitRes = await githubProxyGetJsonResult<{ tree?: { sha?: string } }>(
    userId, accountId, `${base}/git/commits/${commitSha}`,
  )
  if (!commitRes.ok) return { entries: [], error: commitRes.error }
  const treeSha = commitRes.data?.tree?.sha
  if (!treeSha) return { entries: [], error: "Could not resolve git tree" }

  const treeRes = await githubProxyGetJsonResult<{
    tree?: Array<{ path?: string; type?: string; sha?: string }>
  }>(userId, accountId, `${base}/git/trees/${treeSha}?recursive=1`)
  if (!treeRes.ok) return { entries: [], error: treeRes.error }

  const entries = (treeRes.data?.tree ?? []).filter((t) => {
    if (t.type !== "blob" || !t.path || !t.sha) return false
    if (!t.path.toLowerCase().endsWith(".md")) return false
    if (t.path.toLowerCase().includes("/.obsidian/") || t.path.startsWith(".obsidian/")) return false
    if (folderPrefix && !t.path.startsWith(folderPrefix)) return false
    return true
  }).map((t) => ({ path: t.path as string }))

  return { entries }
}

const MAX_FETCHED_FILES_PER_FOLDER = 60
const MAX_FETCH_TOTAL_CHARS_PER_FOLDER = 180_000
const MAX_FETCH_CHARS_PER_FILE = 8_000
const MAX_CACHE_CHARS = 80_000

type VaultProfileRow = {
  github_vault_owner?: string | null
  github_vault_repo?: string | null
  github_vault_branch?: string | null
  github_vault_path?: string | null
  vault_folders?: unknown
}

export type VaultContextSyncResult = {
  ok: boolean
  connected: boolean
  repo: string | null
  branch: string
  folders: string[]
  fileCount: number
  lastSyncedAt: string | null
  cache: string
  error?: string
  warning?: string
}

function joinPrefixes(basePrefix: string | undefined, folder: string): string | undefined {
  const base = (basePrefix ?? "").trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "")
  const next = folder.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "")
  if (!base && !next) return undefined
  if (!base) return next
  if (!next) return base
  return `${base}/${next}`
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text.trim()
  return `${text.slice(0, maxChars).trim()}\n[...truncated by Juno]`
}

function combineSyncErrors(primary: string, fallback?: string): string {
  if (!fallback || fallback === primary) return primary
  const normalizedPrimary = /[.!?]$/.test(primary) ? primary : `${primary}.`
  return `${normalizedPrimary} Direct GitHub fallback also failed: ${fallback}`
}

function buildNoMarkdownMessage(repo: string, branch: string, folders: string[]): string {
  if (folders.length > 0) {
    return `No markdown files found in ${repo} on branch "${branch}" under the selected folders (${folders.join(", ")}). Try clearing the folder filter to sync the whole vault, or choose folders that exist in the repo.`
  }

  return `No markdown files found in ${repo} on branch "${branch}". Push your Obsidian markdown files to GitHub first, or choose the correct branch.`
}

function buildVaultContextCache(params: {
  repo: string
  branch: string
  folders: string[]
  fileCount: number
  files: VaultFile[]
  syncedAt: string
}): string {
  const sections: string[] = [
    `Vault repo: ${params.repo}`,
    `Branch: ${params.branch}`,
    `Folders: ${params.folders.length > 0 ? params.folders.join(", ") : "(all folders)"}`,
    `File count: ${params.fileCount}`,
    `Synced at: ${params.syncedAt}`,
  ]

  let usedChars = sections.join("\n").length

  for (const file of params.files) {
    const block = `\n--- ${file.path} ---\n${truncate(file.content, MAX_FETCH_CHARS_PER_FILE)}`
    if (usedChars + block.length > MAX_CACHE_CHARS && sections.length > 5) break
    sections.push(block)
    usedChars += block.length
  }

  return sections.join("\n")
}

async function syncVaultContextCacheForRow(
  supabase: SupabaseClient,
  userId: string,
  row: VaultProfileRow,
): Promise<VaultContextSyncResult> {
  const repoParts = resolveGithubVaultRepoParts(row as Record<string, unknown>)
  const folders = normalizeVaultFolders(row.vault_folders)
  const branch = row.github_vault_branch?.trim() || "main"

  if (!repoParts) {
    return {
      ok: false,
      connected: false,
      repo: null,
      branch,
      folders,
      fileCount: 0,
      lastSyncedAt: null,
      cache: "",
      error: "Connect a GitHub-backed Obsidian vault first.",
    }
  }

  const config: GithubVaultConfig = {
    owner: repoParts.owner,
    repo: repoParts.repo,
    branch,
    pathPrefix: row.github_vault_path?.trim() || undefined,
  }

  // Try Pipedream-proxied fetch first (uses user's own GitHub OAuth token)
  const pipedreamAccountId = await getGithubAccountId(userId).catch(() => null)

  const allPaths = new Set<string>()
  const fetchedFiles = new Map<string, VaultFile>()

  // Determine effective folder list — empty folders = sync entire root
  const effectiveFolders = folders.length > 0 ? folders : [""]

  for (const folder of effectiveFolders) {
    let listed: { entries: { path: string }[]; error?: string }

    if (pipedreamAccountId) {
      listed = await listVaultPathsViaPipedream(userId, pipedreamAccountId, config, folder || undefined)
      if (listed.error) {
        console.warn("[vault-sync] Pipedream list failed, falling back to direct GitHub:", listed.error)
        const directListed = await listGithubVaultMarkdownPaths(config, folder || undefined)
        listed = directListed.error
          ? { entries: [], error: combineSyncErrors(listed.error, directListed.error) }
          : { entries: directListed.entries.map((entry) => ({ path: entry.path })) }
      }
    } else {
      const directListed = await listGithubVaultMarkdownPaths(config, folder || undefined)
      listed = {
        entries: directListed.entries.map((entry) => ({ path: entry.path })),
        error: directListed.error,
      }
    }

    if (listed.error) {
      await supabase
        .from("company_profile")
        .upsert(
          {
            user_id: userId,
            vault_context_sync_error: listed.error,
          },
          { onConflict: "user_id" },
        )

      return {
        ok: false,
        connected: true,
        repo: repoParts.repoRef,
        branch,
        folders,
        fileCount: 0,
        lastSyncedAt: null,
        cache: "",
        error: listed.error,
      }
    }

    for (const entry of listed.entries) {
      allPaths.add(entry.path)
    }

    let filesResult: { files: VaultFile[]; error?: string }
    const fetchOpts = {
      maxFiles: MAX_FETCHED_FILES_PER_FOLDER,
      maxPerFileChars: MAX_FETCH_CHARS_PER_FILE,
      maxTotalChars: MAX_FETCH_TOTAL_CHARS_PER_FOLDER,
    }

    if (pipedreamAccountId) {
      filesResult = await fetchVaultViaPipedream(userId, pipedreamAccountId, config, {
        ...fetchOpts,
        pathPrefix: joinPrefixes(config.pathPrefix, folder) || undefined,
      })
      if (filesResult.error) {
        console.warn("[vault-sync] Pipedream file fetch failed, falling back to direct GitHub:", filesResult.error)
        const directFiles = await fetchGithubVaultMarkdown(
          { ...config, pathPrefix: joinPrefixes(config.pathPrefix, folder) },
          fetchOpts,
        )
        filesResult = directFiles.error
          ? { files: [], error: combineSyncErrors(filesResult.error, directFiles.error) }
          : directFiles
      }
    } else {
      filesResult = await fetchGithubVaultMarkdown(
        { ...config, pathPrefix: joinPrefixes(config.pathPrefix, folder) },
        fetchOpts,
      )
    }

    if (filesResult.error) {
      await supabase
        .from("company_profile")
        .upsert(
          {
            user_id: userId,
            vault_context_sync_error: filesResult.error,
          },
          { onConflict: "user_id" },
        )

      return {
        ok: false,
        connected: true,
        repo: repoParts.repoRef,
        branch,
        folders,
        fileCount: allPaths.size,
        lastSyncedAt: null,
        cache: "",
        error: filesResult.error,
      }
    }

    for (const file of filesResult.files) {
      fetchedFiles.set(file.path, file)
    }
  }

  const syncedAt = new Date().toISOString()
  const files = [...fetchedFiles.values()].sort((a, b) => a.path.localeCompare(b.path))
  const warning = allPaths.size === 0
    ? buildNoMarkdownMessage(repoParts.repoRef, branch, folders)
    : undefined
  const cache = buildVaultContextCache({
    repo: repoParts.repoRef,
    branch,
    folders,
    fileCount: allPaths.size,
    files,
    syncedAt,
  })

  const { error } = await supabase
    .from("company_profile")
    .upsert(
      {
        user_id: userId,
        vault_context_cache: cache,
        vault_context_last_synced_at: syncedAt,
        vault_context_file_count: allPaths.size,
        vault_context_sync_error: warning ?? null,
      },
      { onConflict: "user_id" },
    )

  if (error) {
    return {
      ok: false,
      connected: true,
      repo: repoParts.repoRef,
      branch,
      folders,
      fileCount: allPaths.size,
      lastSyncedAt: null,
      cache: "",
      error: error.message,
      warning,
    }
  }

  return {
    ok: true,
    connected: true,
    repo: repoParts.repoRef,
    branch,
    folders,
    fileCount: allPaths.size,
    lastSyncedAt: syncedAt,
    cache,
    warning,
  }
}

export async function syncVaultContextCacheForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<VaultContextSyncResult> {
  const { data, error } = await supabase
    .from("company_profile")
    .select("github_vault_owner, github_vault_repo, github_vault_branch, github_vault_path, vault_folders")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      connected: false,
      repo: null,
      branch: "main",
      folders: [],
      fileCount: 0,
      lastSyncedAt: null,
      cache: "",
      error: error.message,
    }
  }

  return syncVaultContextCacheForRow(supabase, userId, (data ?? {}) as VaultProfileRow)
}

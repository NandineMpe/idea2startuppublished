import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchGithubVaultMarkdown,
  listGithubVaultMarkdownPaths,
  resolveGithubVaultRepoParts,
  type GithubVaultConfig,
  type VaultFile,
} from "@/lib/github-vault"
import { normalizeVaultFolders } from "@/lib/vault-context-shared"
import { githubProxyGetJsonResult, getGithubAccountId } from "@/lib/juno/pipedream-github"

/** Build a fetchJson function that routes through Pipedream proxy using the user's connected account. */
async function buildPipedreamFetchJson(userId: string): Promise<((url: string) => Promise<unknown>) | undefined> {
  try {
    const accountId = await getGithubAccountId(userId)
    if (!accountId) return undefined
    return async (url: string) => {
      const result = await githubProxyGetJsonResult<unknown>(userId, accountId, url)
      if (!result.ok) throw new Error(result.error)
      return result.data
    }
  } catch {
    return undefined
  }
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

type VaultSyncTarget =
  | { kind: "organization"; organizationId: string }
  | { kind: "workspace"; workspaceId: string; ownerUserId: string }

async function upsertVaultSyncFields(
  supabase: SupabaseClient,
  userId: string,
  target: VaultSyncTarget,
  fields: {
    vault_context_sync_error?: string | null
    vault_context_cache?: string
    vault_context_last_synced_at?: string | null
    vault_context_file_count?: number | null
  },
) {
  if (target.kind === "organization") {
    return supabase.from("company_profile").upsert(
      {
        organization_id: target.organizationId,
        user_id: userId,
        ...fields,
      },
      { onConflict: "organization_id" },
    )
  }

  return supabase.from("client_workspace_profiles").upsert(
    {
      workspace_id: target.workspaceId,
      owner_user_id: target.ownerUserId,
      ...fields,
    },
    { onConflict: "workspace_id" },
  )
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
  target: VaultSyncTarget,
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

  // Prefer Pipedream proxy (uses the user's OAuth token — works for private repos without a server PAT)
  const fetchJson = await buildPipedreamFetchJson(userId)

  const config: GithubVaultConfig = {
    owner: repoParts.owner,
    repo: repoParts.repo,
    branch,
    pathPrefix: row.github_vault_path?.trim() || undefined,
    fetchJson,
  }

  const allPaths = new Set<string>()
  const fetchedFiles = new Map<string, VaultFile>()

  const effectiveFolders = folders.length > 0 ? folders : [""]

  for (const folder of effectiveFolders) {
    const directListed = await listGithubVaultMarkdownPaths(config, folder || undefined)
    const listed: { entries: { path: string }[]; error?: string } = {
      entries: directListed.entries.map((entry) => ({ path: entry.path })),
      error: directListed.error,
    }

    if (listed.error) {
      await upsertVaultSyncFields(supabase, userId, target, {
        vault_context_sync_error: listed.error,
      })

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

    const fetchOpts = {
      maxFiles: MAX_FETCHED_FILES_PER_FOLDER,
      maxPerFileChars: MAX_FETCH_CHARS_PER_FILE,
      maxTotalChars: MAX_FETCH_TOTAL_CHARS_PER_FOLDER,
    }

    const filesResult = await fetchGithubVaultMarkdown(
      { ...config, pathPrefix: joinPrefixes(config.pathPrefix, folder) },
      fetchOpts,
    )

    if (filesResult.error) {
      await upsertVaultSyncFields(supabase, userId, target, {
        vault_context_sync_error: filesResult.error,
      })

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

  const { error } = await upsertVaultSyncFields(supabase, userId, target, {
    vault_context_cache: cache,
    vault_context_last_synced_at: syncedAt,
    vault_context_file_count: allPaths.size,
    vault_context_sync_error: warning ?? null,
  })

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
  organizationId?: string,
): Promise<VaultContextSyncResult> {
  const { ensurePersonalOrganization, getOrganizationByIdForUser } = await import("@/lib/organizations")

  let orgId = organizationId ?? null
  if (!orgId) {
    const org = await ensurePersonalOrganization(userId)
    orgId = org.id
  } else {
    const verified = await getOrganizationByIdForUser(userId, orgId)
    if (!verified) {
      return {
        ok: false,
        connected: false,
        repo: null,
        branch: "main",
        folders: [],
        fileCount: 0,
        lastSyncedAt: null,
        cache: "",
        error: "Not a member of this organization.",
      }
    }
  }

  const { data, error } = await supabase
    .from("company_profile")
    .select("github_vault_owner, github_vault_repo, github_vault_branch, github_vault_path, vault_folders")
    .eq("organization_id", orgId)
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

  return syncVaultContextCacheForRow(
    supabase,
    userId,
    { kind: "organization", organizationId: orgId },
    (data ?? {}) as VaultProfileRow,
  )
}

export async function syncVaultContextCacheForWorkspace(
  supabase: SupabaseClient,
  ownerUserId: string,
  workspaceId: string,
): Promise<VaultContextSyncResult> {
  const { data, error } = await supabase
    .from("client_workspace_profiles")
    .select("github_vault_owner, github_vault_repo, github_vault_branch, github_vault_path, vault_folders")
    .eq("workspace_id", workspaceId)
    .eq("owner_user_id", ownerUserId)
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

  return syncVaultContextCacheForRow(
    supabase,
    ownerUserId,
    { kind: "workspace", workspaceId, ownerUserId },
    (data ?? {}) as VaultProfileRow,
  )
}

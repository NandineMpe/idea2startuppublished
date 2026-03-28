/**
 * Obsidian vault via GitHub API — read/write markdown for Juno agents.
 * Resolves repo from env (MVP) or `company_profile` github_vault_* fields.
 */

import type { GithubVaultConfig } from "@/lib/github-vault"
import {
  fetchGithubVaultMarkdown,
  listGithubVaultMarkdownPaths,
} from "@/lib/github-vault"

const GITHUB_API = "https://api.github.com"

export type VaultFile = {
  path: string
  content: string
  sha: string
}

function getToken(): string | undefined {
  return process.env.GITHUB_VAULT_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || undefined
}

function headers(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

function normalizePrefix(prefix: string | undefined): string {
  if (!prefix?.trim()) return ""
  let p = prefix.trim().replace(/\\/g, "/")
  if (p.startsWith("/")) p = p.slice(1)
  if (p.length > 0 && !p.endsWith("/")) p += "/"
  return p
}

/** Path inside repo: optional profile prefix + relative path */
function fullPathInRepo(config: GithubVaultConfig, relativePath: string): string {
  const p = normalizePrefix(config.pathPrefix)
  let rel = relativePath.trim().replace(/\\/g, "/")
  if (rel.startsWith("/")) rel = rel.slice(1)
  return p + rel
}

function pathForGithubApi(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/")
}

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

/**
 * Resolve GitHub repo for the vault: `GITHUB_VAULT_REPO` + token (env) takes precedence, else `company_profile` for `userId`.
 */
export async function resolveGithubVaultConfig(userId: string | undefined): Promise<GithubVaultConfig | null> {
  const token = getToken()
  const repoFull = process.env.GITHUB_VAULT_REPO?.trim()
  if (token && repoFull) {
    const idx = repoFull.lastIndexOf("/")
    if (idx > 0) {
      return {
        owner: repoFull.slice(0, idx),
        repo: repoFull.slice(idx + 1),
        branch: process.env.GITHUB_VAULT_BRANCH?.trim() || "main",
        pathPrefix: process.env.GITHUB_VAULT_PATH?.trim() || undefined,
      }
    }
  }

  if (!userId) return null

  const { supabaseAdmin } = await import("@/lib/supabase")
  const { data: row, error } = await supabaseAdmin
    .from("company_profile")
    .select("github_vault_owner, github_vault_repo, github_vault_branch, github_vault_path")
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !row) return null

  const owner = (row.github_vault_owner as string | undefined)?.trim()
  const repo = (row.github_vault_repo as string | undefined)?.trim()
  if (!owner || !repo) return null

  return {
    owner,
    repo,
    branch: ((row.github_vault_branch as string | undefined)?.trim() || "main") as string,
    pathPrefix: (row.github_vault_path as string | undefined) ?? undefined,
  }
}

/**
 * List markdown files (optionally under `folder`, e.g. `company/`).
 */
export async function listVaultFiles(
  folder?: string,
  userId?: string,
): Promise<Array<{ path: string; sha: string; size: number }>> {
  const config = await resolveGithubVaultConfig(userId)
  if (!config) return []

  const { entries, error } = await listGithubVaultMarkdownPaths(config, folder)
  if (error) {
    console.warn("[vault] listVaultFiles:", error)
    return []
  }
  return entries
}

/**
 * Read a single file from the vault (JSON Contents API + base64 body).
 */
export async function readVaultFile(path: string, userId?: string): Promise<VaultFile | null> {
  const config = await resolveGithubVaultConfig(userId)
  const token = getToken()
  if (!config || !token) return null

  const fullPath = fullPathInRepo(config, path)
  const branch = config.branch?.trim() || "main"
  const base = `${GITHUB_API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`

  try {
    const res = await fetch(`${base}/contents/${pathForGithubApi(fullPath)}?ref=${encodeURIComponent(branch)}`, {
      headers: headers(token),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) return null

    const data = (await res.json()) as {
      content?: string
      encoding?: string
      sha?: string
    }

    if (data.encoding !== "base64" || !data.content) return null

    let text: string
    try {
      text = decodeBase64Utf8(data.content)
    } catch {
      return null
    }

    return { path: fullPath, content: text, sha: data.sha ?? "" }
  } catch (e) {
    console.error(`[vault] readVaultFile ${path}:`, e)
    return null
  }
}

export async function readVaultFiles(paths: string[], userId?: string): Promise<VaultFile[]> {
  const results = await Promise.all(paths.map((p) => readVaultFile(p, userId)))
  return results.filter((f): f is VaultFile => f !== null)
}

/**
 * Read markdown under a folder via tree + blob fetch (reuses `fetchGithubVaultMarkdown`).
 */
export async function readVaultFolder(
  folder: string,
  options: { maxFiles?: number; maxCharsPerFile?: number } = {},
  userId?: string,
): Promise<string> {
  const config = await resolveGithubVaultConfig(userId)
  if (!config) return ""

  const folderNorm = folder.replace(/^\//, "").replace(/\\/g, "/")
  const prefix = normalizePrefix(config.pathPrefix) + (folderNorm.endsWith("/") ? folderNorm : `${folderNorm}/`)

  const { files, error } = await fetchGithubVaultMarkdown(
    { ...config, pathPrefix: prefix },
    {
      maxFiles: options.maxFiles ?? 20,
      maxPerFileChars: options.maxCharsPerFile ?? 4000,
      maxTotalChars: 120_000,
    },
  )

  if (error) {
    console.warn("[vault] readVaultFolder:", folder, error)
    return ""
  }

  if (!files?.length) return ""

  return files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n")
}

/**
 * Write or update a file in the vault (GitHub Contents API).
 */
export async function writeVaultFile(
  relativePath: string,
  content: string,
  message: string,
  userId?: string,
): Promise<{ success: boolean; error?: string }> {
  const config = await resolveGithubVaultConfig(userId)
  const token = getToken()
  if (!config || !token) {
    return { success: false, error: "Vault not configured" }
  }

  const path = fullPathInRepo(config, relativePath)
  const branch = config.branch?.trim() || "main"
  const base = `${GITHUB_API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`
  const msg = message.trim() || `Update ${path}`
  const contentB64 = Buffer.from(content, "utf8").toString("base64")

  try {
    const getUrl = `${base}/contents/${pathForGithubApi(path)}?ref=${encodeURIComponent(branch)}`
    const existing = await fetch(getUrl, { headers: headers(token), signal: AbortSignal.timeout(10_000) })
    let sha: string | undefined
    if (existing.ok) {
      const meta = (await existing.json()) as { sha?: string }
      sha = meta.sha
    }

    const putRes = await fetch(`${base}/contents/${pathForGithubApi(path)}`, {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify({
        message: msg,
        content: contentB64,
        branch,
        ...(sha ? { sha } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => "")
      return { success: false, error: `GitHub ${putRes.status}: ${errText.slice(0, 300)}` }
    }

    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Structured vault excerpts for `getCompanyContext` (roadmap, decisions, company/, research/).
 */
export async function getVaultContext(
  userId: string,
  options: { queryHint?: string } = {},
): Promise<string> {
  void options.queryHint
  const config = await resolveGithubVaultConfig(userId)
  if (!config) return ""

  const sections: string[] = []

  const roadmap = await readVaultFile("juno/roadmap.md", userId)
  if (roadmap) {
    sections.push(`=== PRODUCT ROADMAP (from Obsidian) ===\n${roadmap.content}`)
  }

  const decisions = await readVaultFile("juno/decisions.md", userId)
  if (decisions) {
    sections.push(`=== KEY DECISIONS ===\n${decisions.content}`)
  }

  const competitors = await readVaultFile("juno/competitors.md", userId)
  if (competitors) {
    sections.push(`=== COMPETITOR LANDSCAPE (Obsidian, juno/competitors.md) ===\n${competitors.content}`)
  }

  const companyNotes = await readVaultFolder("company", { maxFiles: 10, maxCharsPerFile: 3000 }, userId)
  if (companyNotes) {
    sections.push(`=== COMPANY STRATEGY NOTES (from Obsidian) ===\n${companyNotes}`)
  }

  const competitorNotes = await readVaultFolder("company/competitors", { maxFiles: 10, maxCharsPerFile: 2000 }, userId)
  if (competitorNotes) {
    sections.push(`=== COMPETITOR RESEARCH NOTES ===\n${competitorNotes}`)
  }

  const researchNotes = await readVaultFolder("research", { maxFiles: 5, maxCharsPerFile: 2000 }, userId)
  if (researchNotes) {
    sections.push(`=== RESEARCH NOTES ===\n${researchNotes}`)
  }

  return sections.join("\n\n")
}

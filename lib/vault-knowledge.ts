import { fetchGithubVaultMarkdown, type VaultFile } from "@/lib/github-vault"
import { resolveGithubVaultConfig, writeVaultFile } from "@/lib/juno/vault"

export type VaultKnowledgeHit = {
  path: string
  title: string
  content: string
  excerpt: string
  score: number
}

type SaveVaultKnowledgeParams = {
  content: string
  userId?: string
  title?: string
  sourceUrl?: string
  path?: string
  folder?: string
  noteType?: string
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "we",
  "what",
  "when",
  "where",
  "which",
  "with",
  "your",
])

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || "note"
}

function normalizeFolder(folder: string | undefined): string {
  if (!folder?.trim()) return "juno/knowledge"
  return folder
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").trim()
}

function yamlValue(value: string): string {
  return JSON.stringify(value)
}

function buildKnowledgeMarkdown(params: SaveVaultKnowledgeParams): string {
  const title = (params.title?.trim() || "Knowledge note").trim()
  const noteType = params.noteType?.trim() || "knowledge"
  const createdAt = new Date().toISOString()
  const body = normalizeWhitespace(params.content)

  const lines = [
    "---",
    `title: ${yamlValue(title)}`,
    `type: ${yamlValue(noteType)}`,
    `created_at: ${yamlValue(createdAt)}`,
  ]

  if (params.sourceUrl?.trim()) {
    lines.push(`source_url: ${yamlValue(params.sourceUrl.trim())}`)
  }

  lines.push("---", "", `# ${title}`, "", body)
  return lines.join("\n")
}

function buildKnowledgePath(params: SaveVaultKnowledgeParams): string {
  if (params.path?.trim()) {
    return params.path.trim().replace(/\\/g, "/").replace(/^\/+/, "")
  }

  const folder = normalizeFolder(params.folder)
  const title = params.title?.trim() || "knowledge-note"
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  return `${folder}/${stamp}-${slugify(title)}.md`
}

function tokenizeQuery(query: string): string[] {
  const raw = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !STOP_WORDS.has(token))

  return Array.from(new Set(raw))
}

function titleFromPath(path: string): string {
  const leaf = path.split("/").filter(Boolean).pop() || path
  return leaf.replace(/\.md$/i, "").replace(/[-_]+/g, " ").trim() || path
}

function folderWeight(path: string): number {
  const lower = path.toLowerCase()
  if (lower.startsWith("company/")) return 10
  if (lower.startsWith("juno/")) return 8
  if (lower.startsWith("research/")) return 7
  if (lower.startsWith("sources/")) return 6
  return 4
}

function excerptFor(content: string, query: string, tokens: string[]): string {
  const normalized = normalizeWhitespace(content)
  const lower = normalized.toLowerCase()
  const phrase = query.trim().toLowerCase()

  let index = phrase ? lower.indexOf(phrase) : -1
  if (index < 0) {
    for (const token of tokens) {
      index = lower.indexOf(token)
      if (index >= 0) break
    }
  }

  if (index < 0) {
    return normalized.slice(0, 280)
  }

  const start = Math.max(0, index - 120)
  const end = Math.min(normalized.length, index + 220)
  const snippet = normalized.slice(start, end).trim()
  const prefix = start > 0 ? "..." : ""
  const suffix = end < normalized.length ? "..." : ""
  return `${prefix}${snippet}${suffix}`
}

function scoreFile(file: VaultFile, query: string, tokens: string[]): number {
  const content = file.content.toLowerCase()
  const path = file.path.toLowerCase()
  const phrase = query.trim().toLowerCase()

  let score = folderWeight(path)
  if (phrase && (content.includes(phrase) || path.includes(phrase))) {
    score += 20
  }

  for (const token of tokens) {
    const contentHits = content.split(token).length - 1
    const pathHits = path.split(token).length - 1
    score += Math.min(contentHits, 6) * 3
    score += Math.min(pathHits, 3) * 5
  }

  return score
}

export async function searchVaultKnowledge(
  query: string,
  userId?: string,
  topK = 5,
): Promise<VaultKnowledgeHit[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const config = await resolveGithubVaultConfig(userId)
  if (!config) return []

  const { files, error } = await fetchGithubVaultMarkdown(config, {
    maxFiles: 80,
    maxTotalChars: 180_000,
    maxPerFileChars: 12_000,
  })

  if (error) {
    console.warn("[vault-knowledge] search:", error)
  }

  if (!files.length) return []

  const tokens = tokenizeQuery(trimmed)

  return files
    .map((file) => {
      const score = scoreFile(file, trimmed, tokens)
      return {
        path: file.path,
        title: titleFromPath(file.path),
        content: normalizeWhitespace(file.content),
        excerpt: excerptFor(file.content, trimmed, tokens),
        score,
      }
    })
    .filter((file) => file.score > folderWeight(file.path))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, topK)
}

export async function saveVaultKnowledgeEntry(
  params: SaveVaultKnowledgeParams,
): Promise<{ success: boolean; path?: string; error?: string }> {
  const body = normalizeWhitespace(params.content)
  if (!body) {
    return { success: false, error: "Content is required" }
  }

  const config = await resolveGithubVaultConfig(params.userId)
  if (!config) {
    return { success: false, error: "Obsidian vault is not configured" }
  }

  const path = buildKnowledgePath(params)
  const markdown = buildKnowledgeMarkdown(params)
  const message = `Juno: update ${path}`
  const result = await writeVaultFile(path, markdown, message, params.userId)

  if (!result.success) {
    return { success: false, error: result.error, path }
  }

  return { success: true, path }
}

export const DEFAULT_VAULT_FOLDERS = ["company", "juno", "research"] as const

function normalizeFolderValue(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
}

export function normalizeVaultFolders(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : []

  const seen = new Set<string>()
  const folders: string[] = []

  for (const raw of rawValues) {
    if (typeof raw !== "string") continue
    const normalized = normalizeFolderValue(raw)
    if (!normalized || seen.has(normalized.toLowerCase())) continue
    seen.add(normalized.toLowerCase())
    folders.push(normalized)
  }

  return folders
}

export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g)
  return matches ? matches.length : 0
}

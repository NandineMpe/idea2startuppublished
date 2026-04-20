/**
 * Extract the first top-level `{ ... }` from model output, respecting string literals.
 * Greedy `/\{[\s\S]*\}/` breaks when the model echoes `}` inside JSON string values.
 */
export function extractFirstJsonObject(raw: string): string | null {
  const s = raw.trim()
  const start = s.indexOf("{")
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === "\\" && inString) {
      escape = true
      continue
    }
    if (c === '"' && !escape) {
      inString = !inString
      continue
    }
    if (!inString) {
      if (c === "{") depth++
      else if (c === "}") {
        depth--
        if (depth === 0) return s.slice(start, i + 1)
      }
    }
  }

  return null
}

export function tryParseJsonObject<T = Record<string, unknown>>(raw: string | undefined): T | null {
  if (!raw?.trim()) return null
  const candidate = extractFirstJsonObject(raw) ?? raw.match(/\{[\s\S]*\}/)?.[0]
  if (!candidate) return null
  try {
    return JSON.parse(candidate) as T
  } catch {
    return null
  }
}

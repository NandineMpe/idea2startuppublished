import "server-only"

import fs from "node:fs"
import path from "node:path"

const ENV_FILES = [".env.local", ".env.vercel.local", ".env"]

const fileEnvCache = new Map<string, string>()
let envFilesLoaded = false

function parseEnvLine(line: string) {
  const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/)
  if (!match) return null

  const key = match[1]
  let value = match[2] ?? ""

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return { key, value }
}

function loadEnvFiles() {
  if (envFilesLoaded) return
  envFilesLoaded = true

  for (const filename of ENV_FILES) {
    const filePath = path.join(process.cwd(), filename)
    if (!fs.existsSync(filePath)) continue

    const contents = fs.readFileSync(filePath, "utf8")
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue

      const parsed = parseEnvLine(trimmed)
      if (!parsed) continue

      if (!fileEnvCache.has(parsed.key)) {
        fileEnvCache.set(parsed.key, parsed.value)
      }
    }
  }
}

export function getServerEnv(key: string): string | undefined {
  const runtimeValue = process.env[key]?.trim()
  if (runtimeValue) return runtimeValue

  loadEnvFiles()

  const fileValue = fileEnvCache.get(key)?.trim()
  return fileValue || undefined
}

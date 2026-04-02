function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed.replace(/\/+$/, "")
  return `https://${trimmed.replace(/\/+$/, "")}`
}

export function resolveAppUrl(origin?: string | null): string {
  return (
    normalizeUrl(origin) ??
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeUrl(process.env.NEXT_PUBLIC_VERCEL_URL) ??
    "http://localhost:3000"
  )
}

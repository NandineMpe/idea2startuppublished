import type { Account } from "@pipedream/sdk"

/** Safe JSON shape for the Integrations UI (dates as ISO strings). */
export type PipedreamAccountPublic = {
  id: string
  name?: string
  healthy: boolean | null
  dead: boolean
  error: string | null
  appSlug?: string
  appName?: string
  createdAt: string | null
  updatedAt: string | null
  lastRefreshedAt: string | null
  nextRefreshAt: string | null
  expiresAt: string | null
}

function toIso(d: Date | string | undefined | null): string | null {
  if (d == null) return null
  if (d instanceof Date) return d.toISOString()
  if (typeof d === "string") return d
  return null
}

export function serializePipedreamAccount(a: Account): PipedreamAccountPublic {
  return {
    id: a.id,
    name: a.name,
    healthy: a.healthy ?? null,
    dead: Boolean(a.dead),
    error: a.error ?? null,
    appSlug: a.app?.nameSlug,
    appName: a.app?.name,
    createdAt: toIso(a.createdAt as Date | string | undefined),
    updatedAt: toIso(a.updatedAt as Date | string | undefined),
    lastRefreshedAt: toIso(a.lastRefreshedAt as Date | string | undefined),
    nextRefreshAt: toIso(a.nextRefreshAt as Date | string | undefined),
    expiresAt: toIso(a.expiresAt as Date | string | undefined),
  }
}

/** Best-effort “last activity” for display (Pipedream-side). */
export function latestPipedreamActivityIso(accounts: PipedreamAccountPublic[]): string | null {
  const candidates = accounts.flatMap((x) => [x.lastRefreshedAt, x.updatedAt, x.createdAt].filter(Boolean) as string[])
  if (candidates.length === 0) return null
  let best = candidates[0]!
  let bestT = Date.parse(best)
  for (let i = 1; i < candidates.length; i++) {
    const t = Date.parse(candidates[i]!)
    if (!Number.isNaN(t) && t > bestT) {
      bestT = t
      best = candidates[i]!
    }
  }
  return best
}

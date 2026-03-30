"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Shield, Loader2, ArrowUpRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Counts = { critical: number; high: number; medium: number; low: number; total: number }

export function SecurityAlertsSummary() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch("/api/security?status=open", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) {
        setError(true)
        setCounts(null)
        return
      }
      const data = (await res.json()) as { counts?: Counts }
      setCounts(data.counts ?? { critical: 0, high: 0, medium: 0, low: 0, total: 0 })
    } catch {
      setError(true)
      setCounts(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <Card className="border-border/90">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading security summary…</span>
          </div>
        </CardHeader>
      </Card>
    )
  }

  if (error || !counts) {
    return (
      <Card className="border-border/90 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Security updates
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Could not load findings. Open{" "}
            <Link href="/dashboard/security-updates" className="text-primary hover:underline">
              Security updates
            </Link>{" "}
            to retry.
          </p>
        </CardHeader>
      </Card>
    )
  }

  const hasOpen = counts.total > 0

  return (
    <Card className="border-border/90">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Security updates
          </CardTitle>
          <p className="text-xs text-muted-foreground max-w-xl">
            {hasOpen
              ? `You have ${counts.total} open finding${counts.total === 1 ? "" : "s"} from repo scans (Claude + GitHub).`
              : "No open findings. Daily scans run on your linked repo; you can also scan from Security updates."}
          </p>
        </div>
        <Link
          href="/dashboard/security-updates"
          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
        >
          View all
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {hasOpen ? (
          <div className="flex flex-wrap gap-3 text-sm">
            {counts.critical > 0 && (
              <span className="tabular-nums">
                <span className="text-red-600 dark:text-red-400 font-medium">{counts.critical}</span> critical
              </span>
            )}
            {counts.high > 0 && (
              <span className="tabular-nums">
                <span className="text-orange-600 dark:text-orange-400 font-medium">{counts.high}</span> high
              </span>
            )}
            {counts.medium > 0 && (
              <span className="tabular-nums">
                <span className="text-amber-700 dark:text-amber-300 font-medium">{counts.medium}</span> medium
              </span>
            )}
            {counts.low > 0 && (
              <span className="tabular-nums">
                <span className="text-muted-foreground font-medium">{counts.low}</span> low
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Repo scans only appear here after a run completes. Check{" "}
            <Link href="/dashboard/security-updates" className="text-primary hover:underline">
              Security updates
            </Link>{" "}
            for history and to run a scan.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

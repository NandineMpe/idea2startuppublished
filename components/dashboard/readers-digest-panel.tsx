"use client"

import { FounderDailyFeed } from "@/components/dashboard/founder-daily-feed"
import { AuditAiDigest } from "@/components/dashboard/audit-ai-digest"

/**
 * GTM tab — curated "magazine" view of the same CBS daily brief signal feed,
 * plus the 40-day AI-in-audit deep compilation.
 */
export function ReadersDigestPanel() {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Curated signals for your go-to-market narrative — the same intelligence as your daily brief, organized for a
        quick read between outreach and campaigns.
      </p>

      <AuditAiDigest />

      <FounderDailyFeed
        title="Reader's Digest"
        className="border-amber-200/50 bg-amber-50/20 dark:border-amber-900/45 dark:bg-amber-950/15"
      />
    </div>
  )
}

"use client"

import { useState, useTransition } from "react"
import { decideCreatorWork } from "@/lib/creator/actions"

/** Approve/kill controls for any agent proposal backed by a creator_work row. */
export function DecideButtons({ workId }: { workId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function decide(decision: "approved" | "killed") {
    startTransition(async () => {
      const result = await decideCreatorWork(workId, decision)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => decide("approved")}
        disabled={pending}
        className="h-7 rounded-md bg-violet-600 px-3 text-[12px] font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
      >
        Approve
      </button>
      <button
        onClick={() => decide("killed")}
        disabled={pending}
        className="h-7 rounded-md border border-border px-3 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
      >
        Kill
      </button>
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}
    </div>
  )
}

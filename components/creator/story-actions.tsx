"use client"

import { useState, useTransition } from "react"
import { Archive, Trash2 } from "lucide-react"
import { archiveOrDeleteStory } from "@/lib/creator/actions"

/**
 * Clear a story once it is dealt with.
 *
 * Archive and delete are offered separately because they mean different things
 * downstream: an archived thesis still suppresses repeats in future synthesis
 * runs, a deleted one does not. Delete confirms inline, archive does not, since
 * only one of them loses anything.
 */
export function StoryActions({ storyId }: { storyId: string }) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function run(action: "archive" | "delete") {
    startTransition(async () => {
      setError(null)
      const result = await archiveOrDeleteStory(storyId, action)
      if (!result.ok) setError(result.error)
    })
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5 shrink-0">
        <span className="text-[11px] text-muted-foreground">Delete for good?</span>
        <button
          onClick={() => run("delete")}
          disabled={pending}
          className="h-7 rounded-md bg-red-600 px-2.5 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "…" : "Delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="h-7 rounded-md border border-border px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          No
        </button>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <button
        onClick={() => run("archive")}
        disabled={pending}
        title="Archive — keeps the thesis so it is not proposed again"
        aria-label="Archive story"
        className="text-muted-foreground hover:text-foreground transition-colors p-1 disabled:opacity-50"
      >
        <Archive className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setConfirming(true)}
        disabled={pending}
        title="Delete permanently"
        aria-label="Delete story"
        className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}
    </span>
  )
}

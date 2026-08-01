"use client"

import { useTransition } from "react"
import { Archive, Trash2 } from "lucide-react"
import { archiveCreatorItem, moveToBin, type BinEntity } from "@/lib/creator/actions"
import { RECYCLE_BIN_DAYS } from "@/lib/creator/load-bin"

/**
 * Clear one thing off the screen.
 *
 * Two verbs, because they mean different things to the agents behind the
 * screen. Archive says "handled": the item still counts in the do-not-repeat
 * lists, so the same story or the same move is not proposed again next week.
 * Delete says "this should not have existed": it drops out of those lists
 * entirely and lands in Recently deleted.
 *
 * Neither confirms. Delete used to, back when it was permanent; now the bin is
 * the confirmation, and it is a better one because it is available later rather
 * than only in the second the creator is trying to clear a card.
 */
export function ItemActions({
  entity,
  id,
  noun = "item",
  archiveHint,
}: {
  entity: BinEntity
  id: string
  /** Used in the tooltips, so a draft does not read as "archive item". */
  noun?: string
  archiveHint?: string
}) {
  const [pending, startTransition] = useTransition()

  function run(action: "archive" | "delete") {
    startTransition(async () => {
      await (action === "archive" ? archiveCreatorItem(entity, id) : moveToBin(entity, id))
    })
  }

  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <button
        onClick={() => run("archive")}
        disabled={pending}
        title={archiveHint ?? `Archive — clears this ${noun} but keeps it from being suggested again`}
        aria-label={`Archive ${noun}`}
        className="inline-flex items-center justify-center h-9 w-9 md:h-7 md:w-7 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
      >
        <Archive className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => run("delete")}
        disabled={pending}
        title={`Delete — recoverable from Recently deleted for ${RECYCLE_BIN_DAYS} days`}
        aria-label={`Delete ${noun}`}
        className="inline-flex items-center justify-center h-9 w-9 md:h-7 md:w-7 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

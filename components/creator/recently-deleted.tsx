"use client"

import { useState, useTransition } from "react"
import { RotateCcw, Trash2 } from "lucide-react"
import { deleteForever, emptyRecycleBin, restoreFromBin } from "@/lib/creator/actions"
import { daysLeft, RECYCLE_BIN_DAYS, type BinnedItem } from "@/lib/creator/load-bin"

/**
 * Recently deleted.
 *
 * Deleting anywhere else in the product is a one click action with no confirm,
 * which is only defensible because this screen exists. So the two things it has
 * to make obvious are that the item is still here and how long that stays true.
 *
 * Permanent deletion lives here and nowhere else, and is the only action in the
 * product that confirms.
 */
export function RecentlyDeleted({ items }: { items: BinnedItem[] }) {
  const [pending, startTransition] = useTransition()
  const [confirmingEmpty, setConfirmingEmpty] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      setError(null)
      const result = await fn()
      if (!result.ok) setError(result.error)
      setConfirmingEmpty(false)
      setConfirmingId(null)
    })
  }

  return (
    <section className="mt-8">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[13px] font-semibold text-foreground">Recently deleted</h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
          </div>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-[620px] leading-relaxed">
            Stories, drafts, deals and moves you deleted. They stay here for {RECYCLE_BIN_DAYS} days
            and are then removed for good. While they are here they do not appear on any screen and
            do not stop your agents from proposing something similar again.
          </p>
        </div>

        {items.length > 0 &&
          (confirmingEmpty ? (
            <span className="inline-flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-muted-foreground">Delete all for good?</span>
              <button
                onClick={() => run(() => emptyRecycleBin())}
                disabled={pending}
                className="h-8 rounded-md bg-red-600 px-3 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "…" : "Empty"}
              </button>
              <button
                onClick={() => setConfirmingEmpty(false)}
                className="h-8 rounded-md border border-border px-3 text-[12px] text-muted-foreground hover:text-foreground"
              >
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmingEmpty(true)}
              className="shrink-0 h-8 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-accent transition-colors"
            >
              Empty bin
            </button>
          ))}
      </div>

      {error && <p className="text-[12px] text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {!items.length ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-5">
          <p className="text-[12px] text-muted-foreground">Nothing deleted.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {items.map((item) => {
            const remaining = daysLeft(item.deleted_at)
            const key = `${item.entity}:${item.id}`

            return (
              <div
                key={key}
                className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-foreground leading-snug">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {item.label}
                    {item.has_linked_work ? " and its Desk item" : ""} ·{" "}
                    {remaining === 0
                      ? "removed for good today"
                      : `${remaining} day${remaining === 1 ? "" : "s"} left`}
                  </p>
                </div>

                {confirmingId === key ? (
                  <span className="inline-flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-muted-foreground">For good?</span>
                    <button
                      onClick={() => run(() => deleteForever(item.entity, item.id))}
                      disabled={pending}
                      className="h-7 rounded-md bg-red-600 px-2.5 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {pending ? "…" : "Delete"}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="h-7 rounded-md border border-border px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
                    >
                      No
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => run(() => restoreFromBin(item.entity, item.id))}
                      disabled={pending}
                      title="Put this back"
                      aria-label="Restore"
                      className="inline-flex items-center gap-1.5 h-7 rounded-md border border-border px-2.5 text-[12px] font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restore
                    </button>
                    <button
                      onClick={() => setConfirmingId(key)}
                      disabled={pending}
                      title="Delete permanently"
                      aria-label="Delete permanently"
                      className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

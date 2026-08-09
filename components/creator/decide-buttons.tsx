"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { decideCreatorWork } from "@/lib/creator/actions"
import { KILL_REASONS, type CreatorKillReason } from "@/lib/creator/types"

/**
 * Approve/kill controls for any agent proposal backed by a creator_work row.
 *
 * A kill routes through a reason picker rather than committing straight away.
 * That is one extra tap, deliberately spent: a kill with no reason is the only
 * interaction in the whole product that tells the desk something and then
 * discards it. Six chips, one tap each, no typing required. The optional note
 * is there for the first fortnight while the taxonomy settles and will mostly
 * go unused after that, which is fine.
 */
export function DecideButtons({ workId }: { workId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [note, setNote] = useState("")
  const panelRef = useRef<HTMLDivElement>(null)

  function approve() {
    startTransition(async () => {
      const result = await decideCreatorWork(workId, "approved")
      if (!result.ok) setError(result.error)
    })
  }

  function kill(reason: CreatorKillReason) {
    setPicking(false)
    startTransition(async () => {
      const result = await decideCreatorWork(workId, "killed", reason, note.trim() || undefined)
      if (!result.ok) setError(result.error)
      else setNote("")
    })
  }

  // Number keys while the picker is open. Triage on a laptop is the case this
  // is for: at five a night the difference between reaching for the mouse and
  // not is the difference between labelling and not bothering.
  useEffect(() => {
    if (!picking) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPicking(false)
        return
      }
      const index = Number(e.key) - 1
      if (Number.isInteger(index) && index >= 0 && index < KILL_REASONS.length) {
        const target = e.target as HTMLElement | null
        if (target?.tagName === "TEXTAREA" || target?.tagName === "INPUT") return
        e.preventDefault()
        kill(KILL_REASONS[index].id)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="relative flex items-center gap-2 shrink-0">
      <button
        onClick={approve}
        disabled={pending}
        className="h-9 md:h-7 rounded-md bg-violet-600 px-3 text-[12px] font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
      >
        Approve
      </button>
      <button
        onClick={() => setPicking((open) => !open)}
        disabled={pending}
        aria-expanded={picking}
        className="h-9 md:h-7 rounded-md border border-border px-3 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
      >
        Kill
      </button>
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}

      {picking && (
        <>
          {/* Full-screen dismiss target rather than a blur handler: on touch,
              tapping outside a popover should close it without also activating
              whatever happens to be underneath. */}
          <button
            aria-label="Close"
            onClick={() => setPicking(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            ref={panelRef}
            className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 shadow-lg"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Why is this a no?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {KILL_REASONS.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => kill(r.id)}
                  title={r.hint}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-[12px] text-foreground hover:bg-accent hover:border-violet-500/50 transition-colors"
                >
                  <span className="hidden md:inline text-[10px] tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional. Only worth it if the reason above does not cover it."
              className="mt-2.5 w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </>
      )}
    </div>
  )
}

"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays } from "lucide-react"
import { updateBrandBasics } from "@/lib/creator/brand/actions"
import type { Presentation } from "@/lib/creator/brand/protocols"

/**
 * The two inputs everything else on the screen is computed from.
 *
 * The shoot date because every verdict is arithmetic against it, and the
 * presentation because the same treatment is asked for differently depending on
 * what you are going for. A laminated brow for a masculine presentation is
 * brushed up and flat with no arch added, and a salon's default is the exact
 * opposite, so guidance that does not know which one you want is guidance that
 * gets you the wrong brow.
 */
export function BrandBasics({
  nextShootAt,
  presentation,
}: {
  nextShootAt: string | null
  presentation: Presentation | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function save(formData: FormData) {
    startTransition(async () => {
      setError(null)
      const r = await updateBrandBasics(formData)
      if (!r.ok) setError(r.error)
      else {
        setSaved(true)
        router.refresh()
      }
    })
  }

  return (
    <form action={save} className="rounded-xl border border-border bg-card p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[13px] font-semibold text-foreground">What everything is timed against</h2>
      </div>

      <div className="grid md:grid-cols-[200px_240px_auto] gap-3 items-end">
        <label className="grid gap-1">
          <span className="text-[11px] text-muted-foreground">Next shoot</span>
          <input
            name="next_shoot_at"
            type="date"
            defaultValue={nextShootAt ?? ""}
            className="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-violet-500/60"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-[11px] text-muted-foreground">Presentation</span>
          <select
            name="presentation"
            defaultValue={presentation ?? ""}
            className="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-violet-500/60"
          >
            <option value="">Not set</option>
            <option value="masculine">Masculine</option>
            <option value="androgynous">Androgynous</option>
            <option value="feminine">Feminine</option>
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="h-8 rounded-md bg-violet-600 px-3 text-[12px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {saved && !error && <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Saved</span>}
          {error && <span className="text-[11px] text-amber-700 dark:text-amber-400">{error}</span>}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed max-w-2xl">
        Set a shoot date and every treatment below works backwards from it. Without one the register
        still tracks cadence, but the thing that actually saves you a shoot, being told a peel is too
        late, needs a date to count against.
      </p>
    </form>
  )
}

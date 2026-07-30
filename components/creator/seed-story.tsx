"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PenLine } from "lucide-react"
import { cn } from "@/lib/utils"

const VERDICT_COPY: Record<string, { text: string; className: string }> = {
  well_supported: {
    text: "Stands up. Filed as a dossier with receipts.",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  thin: {
    text: "Partly supported. Filed, but the gap is noted on the card before you approve it.",
    className: "text-amber-700 dark:text-amber-400",
  },
  not_supported: {
    text: "The sources do not back this. Filed to the watchlist rather than the Desk.",
    className: "text-amber-700 dark:text-amber-400",
  },
}

/**
 * Hand the desk your own lead.
 *
 * The scheduled sweep decides what to look at from the canon; this is the other
 * direction. The verdict is surfaced rather than hidden because the useful
 * outcome is sometimes "that does not hold up", and a creator naming a firm on
 * camera carries the risk of getting that wrong.
 */
export function SeedStoryPanel() {
  const router = useRouter()
  const [seed, setSeed] = useState("")
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ verdict: string; receipts: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/creator/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed }),
      })
      const data = (await res.json()) as { verdict?: string; receipts?: number; error?: string }
      if (!res.ok) setError(data.error ?? `Failed (HTTP ${res.status})`)
      else {
        setResult({ verdict: data.verdict ?? "thin", receipts: data.receipts ?? 0 })
        setSeed("")
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setPending(false)
    }
  }

  const verdict = result ? VERDICT_COPY[result.verdict] ?? VERDICT_COPY.thin : null

  return (
    <section className="rounded-xl border border-border bg-card p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <PenLine className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <h2 className="text-[13px] font-semibold text-foreground">Work one of my leads</h2>
      </div>
      <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed max-w-[640px]">
        Name a firm, a case, a claim or a hunch. The desk goes and finds whether it stands up, and
        tells you when it does not.
      </p>

      <textarea
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        rows={3}
        placeholder="e.g. Gondal Accountancy and how mid-market firms are using AI without disclosing it"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-violet-500/60"
      />

      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={submit}
          disabled={pending || seed.trim().length < 6}
          className="h-9 rounded-md bg-violet-600 px-4 text-[13px] font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {pending ? "Working the lead…" : "Investigate"}
        </button>
        {pending && (
          <span className="text-[11px] text-muted-foreground">
            Searching news, papers, books and forums. Up to a minute.
          </span>
        )}
        {error && <span className="text-[12px] text-red-600 dark:text-red-400">{error}</span>}
      </div>

      {verdict && (
        <p className={cn("text-[12px] mt-3 leading-relaxed", verdict.className)}>
          {verdict.text} {result!.receipts} receipt{result!.receipts === 1 ? "" : "s"} found.
        </p>
      )}
    </section>
  )
}

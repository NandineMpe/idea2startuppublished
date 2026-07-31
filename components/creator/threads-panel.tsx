"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { History } from "lucide-react"

/**
 * The two ways a creator starts using threads: open files from what they have
 * already published, and check the ones that are due.
 *
 * Both are also on a cron. The buttons exist because the first run is the one
 * that has to happen while the creator is watching, and because "check this
 * now" is the natural reaction to remembering something.
 */
export function ThreadsPanel({ counts }: { counts: { total: number; due: number } }) {
  const router = useRouter()
  const [pending, setPending] = useState<"open" | "check" | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: "open" | "check") {
    setPending(action)
    setError(null)
    setNote(null)
    try {
      const res = await fetch("/api/creator/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = (await res.json()) as {
        opened?: number
        checked?: number
        moved?: number
        note?: string
        error?: string
      }
      if (!res.ok) setError(data.error ?? `Failed (HTTP ${res.status})`)
      else {
        setNote(
          action === "open"
            ? `Opened ${data.opened ?? 0} file${data.opened === 1 ? "" : "s"}.`
            : data.note ??
                `Checked ${data.checked ?? 0}. ${data.moved ?? 0} moved.`,
        )
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <History className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <h2 className="text-[13px] font-semibold text-foreground">Open files</h2>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[640px]">
            Everything you have covered that was not over when you covered it. The desk goes back to
            the docket, the register and the filing, not to the coverage, because coverage is a
            snapshot and does not update. Nothing moving is a normal answer and is reported as one.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => run("open")}
            disabled={pending !== null}
            className="h-8 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {pending === "open" ? "Reading…" : counts.total ? "Find more" : "Open files"}
          </button>
          <button
            onClick={() => run("check")}
            disabled={pending !== null || counts.due === 0}
            title={counts.due === 0 ? "Nothing due for a check" : undefined}
            className="h-8 rounded-md bg-violet-600 px-3 text-[12px] font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {pending === "check" ? "Checking…" : `Check ${counts.due || ""}`.trim()}
          </button>
        </div>
      </div>

      {pending === "check" && (
        <p className="text-[11px] text-muted-foreground mt-3">
          Searching courts, regulators, filings, standards and the literature for everything
          published since. Up to a minute per file.
        </p>
      )}
      {note && <p className="text-[12px] text-emerald-600 dark:text-emerald-400 mt-3">{note}</p>}
      {error && <p className="text-[12px] text-red-600 dark:text-red-400 mt-3">{error}</p>}
    </section>
  )
}

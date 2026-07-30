"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { deleteCreatorContent } from "@/lib/creator/actions"
import { cn } from "@/lib/utils"
import type { CreatorPost, TranscriptStatus } from "@/lib/creator/types"

const TRANSCRIPT_CLASS: Record<TranscriptStatus, string> = {
  done: "text-emerald-600 dark:text-emerald-400",
  running: "text-sky-600 dark:text-sky-400",
  pending: "text-muted-foreground",
  failed: "text-red-600 dark:text-red-400",
  unavailable: "text-amber-600 dark:text-amber-400",
}

/** Plain-language meaning, so a status never reads as a silent failure. */
const TRANSCRIPT_HELP: Record<TranscriptStatus, string> = {
  done: "Spoken content captured — the strongest input for voice.",
  running: "Transcribing now.",
  pending: "Queued for transcription.",
  failed: "Transcription was attempted and errored.",
  unavailable: "TikTok has no subtitle track for this video, so there is no spoken text to read.",
}

function compact(n: number | null | undefined): string {
  if (typeof n !== "number") return "—"
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}

const TH = "px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground font-medium"

export function CorpusTable({ posts }: { posts: CreatorPost[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState<string | null>(null)
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const allSelected = posts.length > 0 && selected.size === posts.length

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function remove(ids: string[]) {
    startTransition(async () => {
      setError(null)
      const result = await deleteCreatorContent(ids)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSelected(new Set())
      setConfirming(null)
      setBulkConfirm(false)
    })
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2.5">
          <span className="text-[12px] text-foreground">
            {selected.size} selected
          </span>
          {bulkConfirm ? (
            <>
              <span className="text-[12px] text-muted-foreground">
                Delete {selected.size} post{selected.size === 1 ? "" : "s"} from the corpus?
              </span>
              <button
                onClick={() => remove([...selected])}
                disabled={pending}
                className="h-7 rounded-md bg-red-600 px-3 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setBulkConfirm(false)}
                className="h-7 rounded-md border border-border px-3 text-[12px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setBulkConfirm(true)}
              className="inline-flex items-center gap-1.5 h-7 rounded-md border border-border px-3 text-[12px] font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected
            </button>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[12px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {error && (
        <p className="mb-3 text-[12px] text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[780px]">
          <thead>
            <tr className="border-b border-border">
              <th className={cn(TH, "w-9")}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(posts.map((p) => p.id)))
                  }
                  aria-label="Select all posts"
                  className="align-middle"
                />
              </th>
              <th className={TH}>Posted</th>
              <th className={TH}>Caption</th>
              <th className={TH}>Transcript</th>
              <th className={cn(TH, "text-right")}>Views</th>
              <th className={cn(TH, "text-right")}>Likes</th>
              <th className={cn(TH, "w-10")}>
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                className={cn(
                  "border-b border-border last:border-b-0",
                  selected.has(post.id) && "bg-violet-500/[0.05]",
                  confirming === post.id && "bg-red-500/[0.06]",
                )}
              >
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(post.id)}
                    onChange={() => toggle(post.id)}
                    aria-label={`Select post from ${new Date(post.posted_at).toLocaleDateString()}`}
                  />
                </td>
                <td className="px-4 py-2.5 text-[12px] text-muted-foreground whitespace-nowrap tabular-nums">
                  {new Date(post.posted_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-foreground max-w-[380px] truncate">
                  {post.caption || <span className="text-muted-foreground">No caption</span>}
                </td>
                <td
                  className={cn("px-4 py-2.5 text-[12px]", TRANSCRIPT_CLASS[post.transcript_status])}
                  title={TRANSCRIPT_HELP[post.transcript_status]}
                >
                  {post.transcript_status}
                </td>
                <td className="px-4 py-2.5 text-[12px] text-foreground text-right tabular-nums">
                  {compact(post.metrics?.views)}
                </td>
                <td className="px-4 py-2.5 text-[12px] text-foreground text-right tabular-nums">
                  {compact(post.metrics?.likes)}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  {confirming === post.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => remove([post.id])}
                        disabled={pending}
                        className="h-6 rounded-md bg-red-600 px-2 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {pending ? "…" : "Delete"}
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        className="h-6 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirming(post.id)}
                      title="Delete from corpus"
                      aria-label="Delete from corpus"
                      className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Deleting re-derives your canon, since pillars, formats and voice are built from these posts.
        Anything removed can be re-imported from its URL.
      </p>
    </div>
  )
}

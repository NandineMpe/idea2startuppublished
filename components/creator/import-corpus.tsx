"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileJson, Link2 } from "lucide-react"
import {
  normaliseManualPosts,
  parseTikTokExport,
  type NormalisedPost,
} from "@/lib/creator/ingest/normalise"

const BATCH_SIZE = 400

/**
 * Corpus import. The TikTok export is parsed in the browser so the raw
 * multi-megabyte file never crosses the wire — only normalised rows do.
 */
export function ImportCorpus() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [urls, setUrls] = useState("")

  async function submit(posts: NormalisedPost[]) {
    if (!posts.length) {
      setStatus({ ok: false, text: "Nothing recognisable in that input." })
      return
    }
    let imported = 0
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const res = await fetch("/api/creator/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts: posts.slice(i, i + BATCH_SIZE) }),
      })
      const data = (await res.json()) as { imported?: number; error?: string }
      if (!res.ok) {
        setStatus({ ok: false, text: data.error ?? `Import failed (HTTP ${res.status}).` })
        return
      }
      imported += data.imported ?? 0
    }
    setStatus({
      ok: true,
      text: `Imported ${imported} new post${imported === 1 ? "" : "s"} of ${posts.length} sent. Transcription and canon derivation are queued.`,
    })
    router.refresh()
  }

  function onFile(file: File) {
    startTransition(async () => {
      setStatus(null)
      try {
        const parsed = JSON.parse(await file.text())
        await submit(parseTikTokExport(parsed))
      } catch {
        setStatus({ ok: false, text: "That file is not valid JSON. Use the JSON variant of TikTok's data export." })
      }
    })
  }

  function onUrls() {
    startTransition(async () => {
      setStatus(null)
      const inputs = urls
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((url) => ({ url }))
      await submit(normaliseManualPosts(inputs))
      setUrls("")
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 grid gap-5 max-w-[640px]">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileJson className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <h3 className="text-[13px] font-semibold text-foreground">TikTok data export</h3>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
          TikTok app → Settings → Account → Download your data → <span className="font-medium">JSON</span>. Parsed
          locally in your browser; only the normalised posts are uploaded.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = ""
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="h-9 rounded-md bg-violet-600 px-4 text-[13px] font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {pending ? "Importing…" : "Choose export file"}
        </button>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <h3 className="text-[13px] font-semibold text-foreground">Or paste video URLs</h3>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">One TikTok video URL per line.</p>
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={3}
          placeholder={"https://www.tiktok.com/@you/video/…"}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-violet-500/60"
        />
        <button
          onClick={onUrls}
          disabled={pending || !urls.trim()}
          className="mt-2 h-9 rounded-md border border-border px-4 text-[13px] font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          Import URLs
        </button>
      </div>

      {status && (
        <p
          className={
            status.ok
              ? "text-[12px] text-emerald-600 dark:text-emerald-400"
              : "text-[12px] text-red-600 dark:text-red-400"
          }
        >
          {status.text}
        </p>
      )}
    </div>
  )
}

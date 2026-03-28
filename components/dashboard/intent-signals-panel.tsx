"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ExternalLink, Copy, Check, Loader2, Flame, MessageCircle, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

export type IntentSignalRow = {
  id: string
  platform: string
  signal_type: string
  title: string
  body: string | null
  url: string
  author: string | null
  subreddit: string | null
  engagement_score: number | null
  relevance_score: number | null
  why_relevant: string | null
  suggested_response: string | null
  response_platform: string | null
  urgency: string | null
  matched_keywords: string[] | null
  status: string
  discovered_at: string
}

export function IntentSignalsPanel() {
  const [rows, setRows] = useState<IntentSignalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanHint, setScanHint] = useState<string | null>(null)
  const [copyId, setCopyId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadSilent = useCallback(async () => {
    try {
      const res = await fetch("/api/intelligence/intent-signals")
      if (!res.ok) return
      const json = (await res.json()) as { signals?: IntentSignalRow[] }
      setRows(json.signals ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await loadSilent()
    } finally {
      setLoading(false)
    }
  }, [loadSilent])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current)
    },
    [],
  )

  async function scanNow() {
    setScanning(true)
    setScanError(null)
    setScanHint(null)
    try {
      const res = await fetch("/api/intelligence/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline: "intent" }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setScanError(typeof data.error === "string" ? data.error : "Scan could not start")
        return
      }
      setScanHint(
        "Scan queued. This page polls every 8s for up to 4 minutes.",
      )
      if (pollRef.current) clearInterval(pollRef.current)
      let ticks = 0
      pollRef.current = setInterval(() => {
        ticks++
        void loadSilent()
        if (ticks >= 30) {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
        }
      }, 8000)
    } finally {
      setScanning(false)
    }
  }

  async function copyResponse(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopyId(id)
    setTimeout(() => setCopyId(null), 2000)
  }

  async function markResponded(id: string) {
    setActionId(id)
    try {
      const res = await fetch(`/api/intelligence/intent-signals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "responded" }),
      })
      if (res.ok) await load()
    } finally {
      setActionId(null)
    }
  }

  async function markIrrelevant(id: string) {
    setActionId(id)
    try {
      const res = await fetch(`/api/intelligence/intent-signals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "irrelevant" }),
      })
      if (res.ok) await load()
    } finally {
      setActionId(null)
    }
  }

  const active = rows.filter((r) => r.status === "new")

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">CRO · Type 2</p>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-orange-500 shrink-0" />
            Intent signals
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5 max-w-2xl">
            Reddit and HN threads matched to audit and compliance keywords. Runs on a schedule (every 6 hours) and on demand.
            Suggested replies appear here — edit, send, or discard.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={scanning || loading}
            onClick={() => void scanNow()}
            className="gap-1.5"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Scan now
          </Button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="px-4 pt-2 space-y-2">
        {scanError && (
          <p className="text-[12px] text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2.5 py-2">
            {scanError}
          </p>
        )}
        {scanHint && !scanError && (
          <p className="text-[12px] text-emerald-700 dark:text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-2">
            {scanHint}
          </p>
        )}
      </div>

      <div className="p-4 space-y-4 max-h-[min(70vh,720px)] overflow-y-auto">
        {active.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">
            No new intent signals yet. Use <strong className="text-foreground/90">Scan now</strong> or wait for the
            schedule. If scans never return rows, confirm Inngest is receiving events (Vercel has{" "}
            <code className="text-[11px]">INNGEST_*</code> keys) and{" "}
            <code className="text-[11px]">ANTHROPIC_API_KEY</code> for scoring. Add audit or compliance phrases in{" "}
            <a href="/dashboard/context" className="text-primary hover:underline">
              company context
            </a>
            .
          </p>
        )}

        {active.map((row) => {
          const score = row.relevance_score ?? 0
          const hot = score >= 8
          const when = formatDistanceToNow(new Date(row.discovered_at), { addSuffix: true })
          const reply = row.suggested_response?.trim() ?? ""

          return (
            <article
              key={row.id}
              className={cn(
                "rounded-lg border p-3 space-y-2",
                hot ? "border-orange-500/40 bg-orange-500/[0.06]" : "border-border bg-muted/15",
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {hot && (
                  <span className="inline-flex items-center gap-0.5 text-orange-600 dark:text-orange-400 font-medium">
                    <Flame className="h-3.5 w-3.5" />
                    Hot signal
                  </span>
                )}
                <span className="uppercase">{row.platform}</span>
                {row.subreddit && <span>· r/{row.subreddit}</span>}
                <span>· {when}</span>
                <span className="ml-auto tabular-nums font-medium text-foreground">{score}/10</span>
              </div>

              <h3 className="text-[13px] font-semibold text-foreground leading-snug">{row.title}</h3>
              {row.body && (
                <p className="text-[12px] text-muted-foreground line-clamp-3 whitespace-pre-wrap">{row.body}</p>
              )}

              {row.why_relevant && (
                <div className="rounded-md bg-background/80 border border-border/80 px-2.5 py-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Why it matters</p>
                  <p className="text-[12px] text-foreground/90 leading-relaxed">{row.why_relevant}</p>
                </div>
              )}

              {reply && (
                <div className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-2">
                  <p className="text-[10px] font-medium text-emerald-800 dark:text-emerald-200/90 uppercase mb-1">
                    Suggested response
                  </p>
                  <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap">{reply}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" asChild>
                  <a href={row.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Open thread
                  </a>
                </Button>
                {reply && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={actionId === row.id}
                    onClick={() => void copyResponse(reply, row.id)}
                  >
                    {copyId === row.id ? (
                      <Check className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1" />
                    )}
                    {copyId === row.id ? "Copied" : "Copy response"}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={actionId === row.id}
                  onClick={() => void markResponded(row.id)}
                >
                  Mark responded
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={actionId === row.id}
                  onClick={() => void markIrrelevant(row.id)}
                >
                  Not relevant
                </Button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

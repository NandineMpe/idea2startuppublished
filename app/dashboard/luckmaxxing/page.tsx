"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  Brain,
  ExternalLink,
  Github,
  Loader2,
  MessageCircle,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react"
import { REDDIT_SUBREDDITS } from "@/lib/juno/intent-keywords"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

const AUTO_SCAN_SESSION_KEY = "juno.luckmaxxing.reddit-auto-scan"

const pillars = [
  "Listen to real buyer pain from public Reddit threads.",
  "Reconcile each thread against your saved context and vault.",
  "Turn repeated frustrations into opportunities and product gaps.",
] as const

type IntentSignalRow = {
  id: string
  platform: string
  signal_type: string
  title: string
  body: string | null
  url: string
  subreddit: string | null
  relevance_score: number | null
  why_relevant: string | null
  urgency: string | null
  matched_keywords: string[] | null
  status: string
  discovered_at: string
}

type WatchlistSnapshot = {
  watchTerms: string[]
  suggestions: string[]
  limit: number
}

type RedditReconData = {
  companyName: string
  conversationCount: number
  contextSources: string[]
  contextLastSyncedAt: string | null
  vaultConnected: boolean
  overview: string
  themes: Array<{ title: string; detail: string }>
  simulatedConversations: Array<{ speaker: string; message: string; implication: string }>
  opportunities: string[]
  gaps: string[]
  nextMoves: string[]
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Not yet"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return "Not yet"
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

export default function LuckmaxxingPage() {
  const { toast } = useToast()
  const autoScanAttemptedRef = useRef(false)
  const [signals, setSignals] = useState<IntentSignalRow[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistSnapshot | null>(null)
  const [recon, setRecon] = useState<RedditReconData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [runningScan, setRunningScan] = useState(false)
  const [watchTermDraft, setWatchTermDraft] = useState("")
  const [savingWatchTerm, setSavingWatchTerm] = useState(false)
  const [removingWatchTerm, setRemovingWatchTerm] = useState<string | null>(null)
  const [lastQueuedLabel, setLastQueuedLabel] = useState<string | null>(null)

  const latestSignalSeenAt = signals[0]?.discovered_at ?? null
  const watchTerms = watchlist?.watchTerms ?? []

  function scheduleRefresh() {
    window.setTimeout(() => void loadData(true), 3500)
    window.setTimeout(() => void loadData(), 12000)
  }

  async function triggerRedditScan() {
    const res = await fetch("/api/intelligence/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pipeline: "intent" }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) throw new Error(json.error || "Could not queue the Reddit scan.")
  }

  async function loadData(showSpinner = false) {
    if (showSpinner) setRefreshing(true)
    try {
      const [signalsRes, watchlistRes, reconRes] = await Promise.all([
        fetch("/api/intelligence/intent-signals?platform=reddit&limit=24", { credentials: "include" }),
        fetch("/api/luckmaxxing/watchlist", { credentials: "include" }),
        fetch("/api/luckmaxxing/reddit-recon", { credentials: "include" }),
      ])

      const signalsJson = (await signalsRes.json().catch(() => ({}))) as {
        signals?: IntentSignalRow[]
        error?: string
      }
      const watchlistJson = (await watchlistRes.json().catch(() => ({}))) as WatchlistSnapshot & { error?: string }
      const reconJson = (await reconRes.json().catch(() => ({}))) as { data?: RedditReconData; error?: string }

      if (!signalsRes.ok) throw new Error(signalsJson.error || "Could not load Reddit signals.")
      if (!watchlistRes.ok) throw new Error(watchlistJson.error || "Could not load Reddit scan priorities.")

      setSignals(Array.isArray(signalsJson.signals) ? signalsJson.signals : [])
      setWatchlist({
        watchTerms: Array.isArray(watchlistJson.watchTerms) ? watchlistJson.watchTerms : [],
        suggestions: Array.isArray(watchlistJson.suggestions) ? watchlistJson.suggestions : [],
        limit: Number(watchlistJson.limit ?? 24) || 24,
      })
      setRecon(reconRes.ok ? reconJson.data ?? null : null)
    } catch (error) {
      toast({
        title: "Could not load Reddit research",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (loading || autoScanAttemptedRef.current || !recon?.companyName) return
    autoScanAttemptedRef.current = true

    const latestSeenAt = latestSignalSeenAt ? new Date(latestSignalSeenAt).getTime() : Number.NaN
    const stale = !Number.isFinite(latestSeenAt) || Date.now() - latestSeenAt > 6 * 60 * 60 * 1000
    if (!stale || typeof window === "undefined") return

    const sessionKey = `${AUTO_SCAN_SESSION_KEY}:${new Date().toISOString().slice(0, 10)}`
    if (window.sessionStorage.getItem(sessionKey)) return
    window.sessionStorage.setItem(sessionKey, "1")
    void runRedditScan("Reddit sync", true)
  }, [loading, latestSignalSeenAt, recon?.companyName])

  async function runRedditScan(label: string, auto = false) {
    setRunningScan(true)
    try {
      await triggerRedditScan()
      setLastQueuedLabel(label)
      toast({
        title: auto ? "Reddit scan started automatically" : `${label} queued`,
        description: auto
          ? "Luckmaxxing kicked off a fresh Reddit scan so this page can hydrate with live conversations."
          : "Juno is scanning Reddit now and this page will refresh automatically.",
      })
      scheduleRefresh()
    } catch (error) {
      toast({
        title: "Could not start Reddit scan",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setRunningScan(false)
    }
  }

  async function addWatchTerm(rawTerm?: string) {
    const term = (rawTerm ?? watchTermDraft).trim()
    if (!term) return
    setSavingWatchTerm(true)
    try {
      const res = await fetch("/api/luckmaxxing/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ term }),
      })
      const json = (await res.json().catch(() => ({}))) as WatchlistSnapshot & { error?: string }
      if (!res.ok) throw new Error(json.error || "Could not save the scan priority.")
      setWatchlist({
        watchTerms: Array.isArray(json.watchTerms) ? json.watchTerms : [],
        suggestions: Array.isArray(json.suggestions) ? json.suggestions : [],
        limit: Number(json.limit ?? 24) || 24,
      })
      setWatchTermDraft("")
    } catch (error) {
      toast({
        title: "Could not save scan priority",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setSavingWatchTerm(false)
    }
  }

  async function removeWatchTerm(term: string) {
    setRemovingWatchTerm(term)
    try {
      const res = await fetch("/api/luckmaxxing/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ term }),
      })
      const json = (await res.json().catch(() => ({}))) as WatchlistSnapshot & { error?: string }
      if (!res.ok) throw new Error(json.error || "Could not remove the scan priority.")
      setWatchlist({
        watchTerms: Array.isArray(json.watchTerms) ? json.watchTerms : [],
        suggestions: Array.isArray(json.suggestions) ? json.suggestions : [],
        limit: Number(json.limit ?? 24) || 24,
      })
    } catch (error) {
      toast({
        title: "Could not remove scan priority",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setRemovingWatchTerm(null)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Surface area</p>
          <h1 className="text-2xl font-semibold text-foreground">Luckmaxxing</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Reddit-first customer signal board. Juno scans public Reddit conversations, reconciles them against your
            saved context and GitHub-backed vault, then surfaces what people keep asking for, where the opportunity is,
            and where your current product story still looks thin.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void loadData(true)} disabled={refreshing || runningScan} className="gap-2">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button type="button" onClick={() => void runRedditScan("Reddit sync")} disabled={runningScan || refreshing} className="gap-2">
            {runningScan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
            Sync Reddit now
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {pillars.map((pillar) => (
          <div key={pillar} className="rounded-lg border border-border bg-card p-4 text-[13px] leading-relaxed text-muted-foreground shadow-sm">
            {pillar}
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm"><div className="text-[11px] text-muted-foreground">Scan priorities</div><div className="mt-1 text-sm font-medium text-foreground">{loading ? "Loading..." : `${watchTerms.length}/${watchlist?.limit ?? 24}`}</div></div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm"><div className="text-[11px] text-muted-foreground">Reddit threads loaded</div><div className="mt-1 text-sm font-medium text-foreground">{loading ? "Loading..." : `${signals.length}`}</div></div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm"><div className="text-[11px] text-muted-foreground">Latest Reddit signal</div><div className="mt-1 text-sm font-medium text-foreground">{formatDateTime(latestSignalSeenAt)}</div></div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm"><div className="text-[11px] text-muted-foreground">Subreddits covered</div><div className="mt-1 text-sm font-medium text-foreground">{REDDIT_SUBREDDITS.length}</div></div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold text-foreground">Reddit Scan Priorities</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Add company names, pain phrases, buyer job titles, or workflow language you want Juno to prioritize when it scans Reddit.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">Reddit public read is live</div>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="text" value={watchTermDraft} onChange={(event) => setWatchTermDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addWatchTerm() } }} placeholder='Add a pain phrase or company, e.g. "cofounder tool"' className="h-10 flex-1 text-sm" />
            <Button type="button" onClick={() => void addWatchTerm()} disabled={savingWatchTerm || !watchTermDraft.trim()} className="gap-2">
              {savingWatchTerm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add priority
            </Button>
          </div>
          {watchlist?.suggestions?.length ? (
            <div className="flex flex-wrap gap-2">
              {watchlist.suggestions.filter((term) => !watchTerms.some((value) => value.toLowerCase() === term.toLowerCase())).slice(0, 6).map((term) => (
                <button key={term} type="button" onClick={() => void addWatchTerm(term)} disabled={savingWatchTerm} className="rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-muted">+ {term}</button>
              ))}
            </div>
          ) : null}
          {!loading && watchTerms.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              No scan priorities saved yet. Add a few product names, buyer roles, or pain phrases and then run a fresh
              Reddit sync.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {watchTerms.map((term) => (
              <span key={term} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/20 px-2 py-1 text-[12px] text-foreground">
                <span>{term}</span>
                <button type="button" onClick={() => void removeWatchTerm(term)} disabled={removingWatchTerm === term} className="text-muted-foreground transition-colors hover:text-foreground" title={`Remove ${term}`}>
                  {removingWatchTerm === term ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground"><Brain className="h-4 w-4 text-primary" /><h2 className="text-[13px] font-semibold">What Reddit Is Saying</h2></div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{recon?.overview || "Run a Reddit sync and Luckmaxxing will summarize the strongest recurring patterns here."}</p>
          <div className="mt-3 space-y-3">
            {(recon?.themes ?? []).map((theme) => (
              <div key={theme.title} className="rounded-md border border-border bg-muted/15 p-3">
                <p className="text-[12px] font-medium text-foreground">{theme.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{theme.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground"><MessageCircle className="h-4 w-4 text-primary" /><h2 className="text-[13px] font-semibold">Simulated Customer Conversations</h2></div>
          <div className="mt-3 space-y-3">
            {(recon?.simulatedConversations ?? []).map((conversation, index) => (
              <div key={`${conversation.speaker}-${index}`} className="rounded-md border border-border bg-muted/15 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{conversation.speaker}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-foreground">{conversation.message}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{conversation.implication}</p>
              </div>
            ))}
            {!(recon?.simulatedConversations?.length) ? <p className="text-[12px] leading-relaxed text-muted-foreground">Once Reddit threads are loaded, Juno will synthesize them into customer-style conversations you can use to pressure-test demand.</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground"><Sparkles className="h-4 w-4 text-primary" /><h2 className="text-[13px] font-semibold">Opportunities To Pursue</h2></div>
          <ul className="mt-3 space-y-2">
            {(recon?.opportunities ?? []).map((opportunity) => <li key={opportunity} className="text-[12px] leading-relaxed text-muted-foreground">{opportunity}</li>)}
            {!(recon?.opportunities?.length) ? <li className="text-[12px] leading-relaxed text-muted-foreground">The strongest product opportunities will appear here after the next Reddit sync.</li> : null}
          </ul>
          {recon?.nextMoves?.length ? (
            <div className="mt-3 rounded-md border border-border bg-muted/15 p-3">
              <p className="text-[12px] font-medium text-foreground">What to do next</p>
              <ul className="mt-2 space-y-2">
                {recon.nextMoves.map((move) => <li key={move} className="text-[12px] leading-relaxed text-muted-foreground">{move}</li>)}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground"><Github className="h-4 w-4 text-primary" /><h2 className="text-[13px] font-semibold">Context Gaps And Grounding</h2></div>
          <ul className="mt-3 space-y-2">
            {(recon?.gaps ?? []).map((gap) => <li key={gap} className="text-[12px] leading-relaxed text-muted-foreground">{gap}</li>)}
            {!(recon?.gaps?.length) ? <li className="text-[12px] leading-relaxed text-muted-foreground">This area will call out where Reddit demand looks stronger or clearer than your current saved context.</li> : null}
          </ul>
          <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-[12px] font-medium text-foreground">Sources in play</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(recon?.contextSources ?? ["Company profile"]).map((source) => <span key={source} className="inline-flex rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">{source}</span>)}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Last context refresh: {formatDateTime(recon?.contextLastSyncedAt ?? null)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{recon?.vaultConnected ? "Vault-backed context is connected." : "Connect the GitHub-backed vault to deepen the reconciliation."}</p>
            <Link href="/dashboard/context" className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80">Open Context <ExternalLink className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-foreground"><Radio className="h-4 w-4 text-primary" /><h2 className="text-[13px] font-semibold">Latest Reddit Threads</h2></div>
        <p className="mt-2 text-[12px] text-muted-foreground">{lastQueuedLabel ? `${lastQueuedLabel} was queued. Give the worker a few seconds if the list has not refreshed yet.` : "Luckmaxxing will auto-kick a fresh Reddit scan if your saved conversations look stale when you open this page."}</p>
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading Reddit threads...</div>
          ) : signals.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-muted-foreground">No Reddit threads saved yet. Run a sync and Juno will start pulling in live customer conversations here.</p>
          ) : (
            signals.map((signal) => (
              <div key={signal.id} className="rounded-md border border-border bg-muted/15 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground">{signal.title}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{signal.subreddit ? `r/${signal.subreddit}` : "Reddit"} / {signal.signal_type.replace(/_/g, " ")} / {signal.relevance_score ?? "?"}/10</p>
                  </div>
                  <a href={signal.url} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground" title="Open thread"><ExternalLink className="h-3.5 w-3.5" /></a>
                </div>
                {signal.body ? <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">{signal.body}</p> : null}
                {signal.why_relevant ? <p className="mt-2 text-[12px] leading-relaxed text-foreground/90">{signal.why_relevant}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{signal.urgency ?? "monitor"}</span>
                  <span>{formatDateTime(signal.discovered_at)}</span>
                  {signal.matched_keywords?.slice(0, 4).map((keyword) => <span key={keyword} className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground">{keyword}</span>)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

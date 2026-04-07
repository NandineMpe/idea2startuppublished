"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUpRight,
  Brain,
  Filter,
  Loader2,
  MessageCircle,
  RefreshCw,
  Radio,
  Search,
  SendHorizonal,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

type BehavioralTheme = {
  title: string
  detail: string
}

type BehavioralSummary = {
  overview: string
  sentiment: string
  themes: BehavioralTheme[]
  pushOfPresent: string[]
  pullOfNew: string[]
  anxietyOfNew: string[]
  allegianceToOld: string[]
  currentSolutions: string[]
  frictionPoints: string[]
  workarounds: string[]
  discoveryPaths: string[]
  buyingProcess: string[]
  painPoints: string[]
  gains: string[]
  nextMoves: string[]
}

type BehavioralThread = {
  id: string
  title: string
  body: string | null
  url: string
  author: string | null
  subreddit: string | null
  signal_type: string
  relevance_score: number | null
  why_relevant: string | null
  matched_keywords: string[] | null
  urgency: string | null
  status: string
  discovered_at: string
}

type BehavioralUpdatesData = BehavioralSummary & {
  companyName: string
  conversationCount: number
  latestThreadAt: string | null
  contextSources: string[]
  contextLastSyncedAt: string | null
  vaultConnected: boolean
  selectedSubreddit: string | null
  subreddits: string[]
  /** Saved scan targets; null means each run uses context-derived suggestions plus defaults. */
  redditIntentSaved: string[] | null
  redditScanDefaults: string[]
  /** True when the LLM summary is built from all Reddit signals together (no subreddit filter). */
  synthesisCombined?: boolean
  /** Distinct subreddits present in the batch used for the overview (up to 24 recent signals). */
  subredditsInSynthesisBatch?: string[]
  threads: BehavioralThread[]
  summarySource: "cached" | "live"
  generatedAt: string
  /** From latest behavioral_updates run metadata (e.g. no_candidates). */
  lastScanOutcome?: string | null
  /** When the latest behavioral_updates row was written (any outcome). */
  lastBehavioralArtifactAt?: string | null
}

type SubredditSuggestion = { name: string; reason: string }

const MAX_SCAN_SUBREDDITS = 12

type BehavioralUpdatesResponse = {
  data?: BehavioralUpdatesData
  error?: string
}

function stripPreview(text: string | null | undefined, max = 220) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  return normalized.length > max ? `${normalized.slice(0, max - 1).trimEnd()}...` : normalized
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return "Not yet"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return "Not yet"
  return formatDistanceToNow(parsed, { addSuffix: true })
}

function ResearchListCard({
  title,
  description,
  items,
  icon,
  accordionValue,
}: {
  title: string
  description: string
  items: string[]
  icon: typeof Brain
  accordionValue: string
}) {
  const Icon = icon

  return (
    <Accordion type="single" collapsible defaultValue={accordionValue} className="rounded-xl border border-border bg-background/80 shadow-sm">
      <AccordionItem value={accordionValue} className="border-none">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">{title}</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <ul className="space-y-2">
            {items.length > 0 ? (
              items.map((item) => (
                <li key={item} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[12px] leading-relaxed text-foreground/90">
                  {item}
                </li>
              ))
            ) : (
              <li className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-2 text-[12px] text-muted-foreground">
                No signal yet.
              </li>
            )}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export function BehavioralUpdatesPanel() {
  const [data, setData] = useState<BehavioralUpdatesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanHint, setScanHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSubreddit, setSelectedSubreddit] = useState("all")
  const [useAutoSubreddits, setUseAutoSubreddits] = useState(true)
  const [pinnedSubreddits, setPinnedSubreddits] = useState<string[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SubredditSuggestion[]>([])
  const [saveTargetsLoading, setSaveTargetsLoading] = useState(false)
  const [targetsHint, setTargetsHint] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Question / ask-the-data state
  const [question, setQuestion] = useState("")
  const [querying, setQuerying] = useState(false)
  const [queryResult, setQueryResult] = useState<{
    answer: string
    keyFindings: string[]
    threads: { title: string; url: string; subreddit: string | null; relevance_score: number | null }[]
    signalsSearched: number
  } | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)

  const loadData = useCallback(
    async (subredditValue: string, showSpinner = false) => {
      if (showSpinner) setRefreshing(true)
      if (!showSpinner) setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (subredditValue && subredditValue !== "all") {
          params.set("subreddit", subredditValue)
        } else if (showSpinner) {
          params.set("refresh", "1")
        }
        const q = params.toString()
        const res = await fetch(`/api/intelligence/behavioral-updates${q ? `?${q}` : ""}`, {
          cache: "no-store",
        })
        const json = (await res.json().catch(() => ({}))) as BehavioralUpdatesResponse

        if (!res.ok || !json.data) {
          throw new Error(typeof json.error === "string" ? json.error : "Could not load behavioral updates.")
        }

        setData(json.data)
        const saved = json.data.redditIntentSaved
        if (saved === null || saved === undefined) {
          setUseAutoSubreddits(true)
          setPinnedSubreddits([])
        } else {
          setUseAutoSubreddits(false)
          setPinnedSubreddits(saved)
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load behavioral updates.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadData(selectedSubreddit)
  }, [loadData, selectedSubreddit])

  useEffect(
    () => () => {
      pollRef.current.forEach((timer) => clearTimeout(timer))
      pollRef.current = []
    },
    [],
  )

  const subredditOptions = useMemo(() => {
    const values = data?.subreddits ?? []
    return ["all", ...values.filter((value) => value && value.toLowerCase() !== "all")]
  }, [data?.subreddits])

  async function runSuggestSubreddits() {
    setSuggestLoading(true)
    setTargetsHint(null)
    setSuggestions([])
    try {
      const res = await fetch("/api/intelligence/reddit-subreddits", {
        method: "POST",
        cache: "no-store",
      })
      const json = (await res.json().catch(() => ({}))) as {
        suggestions?: SubredditSuggestion[]
        error?: string
      }
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Could not suggest subreddits.")
      }
      setSuggestions(json.suggestions ?? [])
      if ((json.suggestions ?? []).length === 0) {
        setTargetsHint("No suggestions returned. Check LLM configuration or try again after adding more context.")
      }
    } catch (e) {
      setTargetsHint(e instanceof Error ? e.message : "Suggestion failed.")
    } finally {
      setSuggestLoading(false)
    }
  }

  function togglePinnedSub(name: string) {
    const n = name.toLowerCase().trim().replace(/^r\//i, "")
    if (!/^[a-z0-9_]{2,32}$/.test(n)) return
    setPinnedSubreddits((prev) => {
      const has = prev.includes(n)
      if (has) return prev.filter((s) => s !== n)
      if (prev.length >= MAX_SCAN_SUBREDDITS) return prev
      return [...prev, n]
    })
  }

  function mergeSuggestionsIntoPins() {
    setPinnedSubreddits((prev) => {
      const merged = [...new Set([...prev, ...suggestions.map((s) => s.name.toLowerCase())])]
      return merged.slice(0, MAX_SCAN_SUBREDDITS)
    })
  }

  async function saveSubredditTargets() {
    setSaveTargetsLoading(true)
    setTargetsHint(null)
    setError(null)
    try {
      const body =
        useAutoSubreddits || pinnedSubreddits.length === 0
          ? { reddit_intent_subreddits: null }
          : { reddit_intent_subreddits: pinnedSubreddits.slice(0, MAX_SCAN_SUBREDDITS) }

      const res = await fetch("/api/company/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(
          typeof json.error === "string" ? json.error : "Could not save subreddit targets.",
        )
        return
      }
      setTargetsHint(
        useAutoSubreddits || pinnedSubreddits.length === 0
          ? "Scanner will pick subreddits from your context each run (merged with built-in defaults)."
          : `Saved ${pinnedSubreddits.length} subreddit targets for scans.`,
      )
      void loadData(selectedSubreddit, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setSaveTargetsLoading(false)
    }
  }

  async function triggerScan() {
    setScanning(true)
    setScanHint(null)
    setError(null)

    try {
      const res = await fetch("/api/intelligence/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline: "intent" }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Could not queue the Reddit scan.")
      }

      setScanHint("Behavioral updates queued. The panel will refresh automatically as new Reddit research lands.")

      pollRef.current.forEach((timer) => clearTimeout(timer))
      pollRef.current = [
        setTimeout(() => void loadData(selectedSubreddit, true), 4000),
        setTimeout(() => void loadData(selectedSubreddit, true), 12000),
        setTimeout(() => void loadData(selectedSubreddit, true), 24000),
      ]
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Could not queue the Reddit scan.")
    } finally {
      setScanning(false)
    }
  }

  async function askQuestion() {
    if (!question.trim() || querying) return
    setQuerying(true)
    setQueryError(null)
    setQueryResult(null)
    try {
      const res = await fetch("/api/intelligence/behavioral-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      })
      let json: { answer?: string; keyFindings?: string[]; threads?: { title: string; url: string; subreddit: string | null; relevance_score: number | null }[]; signalsSearched?: number; error?: string } = {}
      try { json = await res.json() } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Query failed")
      setQueryResult({
        answer: json.answer ?? "",
        keyFindings: json.keyFindings ?? [],
        threads: (json.threads ?? []) as { title: string; url: string; subreddit: string | null; relevance_score: number | null }[],
        signalsSearched: json.signalsSearched ?? 0,
      })
    } catch (e) {
      setQueryError(e instanceof Error ? e.message : "Query failed")
    } finally {
      setQuerying(false)
    }
  }

  return (
    <section
      id="behavioral-updates"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="border-b border-border bg-muted/20 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              CRO - Behavioral Updates
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Brain className="h-5 w-5 shrink-0 text-orange-500" />
              Reddit customer research
            </h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
              Secondary customer research from live subreddit discussions. This is where we map what people want,
              what they are tolerating today, what makes them nervous about switching, and what success would look
              like if they changed.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-[220px]">
              <Select value={selectedSubreddit} onValueChange={setSelectedSubreddit}>
                <SelectTrigger className="h-9 text-[12px]">
                  <SelectValue placeholder="All subreddits" />
                </SelectTrigger>
                <SelectContent>
                  {subredditOptions.map((subreddit) => (
                    <SelectItem key={subreddit} value={subreddit}>
                      {subreddit === "all" ? "All subreddits" : `r/${subreddit}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadData(selectedSubreddit, true)}
              disabled={refreshing || scanning}
              className="gap-2"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => void triggerScan()}
              disabled={refreshing || scanning}
              className="gap-2"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
              Scan Reddit now
            </Button>
          </div>
        </div>

        {data ? (
          <div className="mt-4 rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4">
            {data.lastScanOutcome === "no_candidates" ? (
              <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-[12px] text-amber-950 dark:text-amber-100/95">
                <p className="font-medium">Last Reddit scan returned no threads to score</p>
                <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                  The job finished, but we could not load posts from Reddit for your targets (subreddit feeds and fallback search both came back empty). That is usually Reddit blocking or throttling server requests, an empty or invalid subreddit list, or no posts in your lookback window. It is not a keyword filter on your side. Check pinned subreddit names, try{" "}
                  <code className="text-[10px]">INTENT_LOOKBACK_DAYS</code>, or run the scan again later.
                </p>
                <p className="mt-2 border-t border-amber-500/20 pt-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/90">Diagnostics</span>
                  {" · "}
                  Last saved run:{" "}
                  {data.lastBehavioralArtifactAt ? formatRelative(data.lastBehavioralArtifactAt) : "unknown"}
                  {" · "}
                  Inngest function <code className="rounded bg-background/80 px-1 py-px text-[10px]">cro-intent-scanner</code>
                  {" · "}
                  Search run logs for{" "}
                  <code className="rounded bg-background/80 px-1 py-px text-[10px]">[intent-monitor]</code>{" "}
                  (HTTP 403 or 429 means Reddit blocked the server).
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <p className="text-[12px] font-medium text-foreground">Subreddits for scans</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Choose automatic picks from your company context each run, or pin a list. Pinned lists cap at{" "}
                  {MAX_SCAN_SUBREDDITS} communities.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={useAutoSubreddits ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-[11px]"
                    onClick={() => {
                      setUseAutoSubreddits(true)
                      setPinnedSubreddits([])
                    }}
                  >
                    Automatic from context
                  </Button>
                  <Button
                    type="button"
                    variant={!useAutoSubreddits ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-[11px]"
                    onClick={() => setUseAutoSubreddits(false)}
                  >
                    Pin my list
                  </Button>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1.5 text-[11px]"
                  disabled={suggestLoading || useAutoSubreddits}
                  onClick={() => void runSuggestSubreddits()}
                  title={useAutoSubreddits ? "Switch to Pin my list to apply suggestions" : undefined}
                >
                  {suggestLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Suggest from context
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-[11px]"
                  disabled={saveTargetsLoading}
                  onClick={() => void saveSubredditTargets()}
                >
                  {saveTargetsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save scan targets
                </Button>
              </div>
            </div>

            {!useAutoSubreddits ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-muted-foreground">Tap to toggle. Pool includes defaults, signals, and saved picks.</p>
                <div className="flex flex-wrap gap-1.5">
                  {(data?.subreddits ?? []).map((sub) => {
                    const active = pinnedSubreddits.includes(sub.toLowerCase())
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => togglePinnedSub(sub)}
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                          active
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border bg-background/80 text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        r/{sub}
                      </button>
                    )
                  })}
                </div>
                {suggestions.length > 0 ? (
                  <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-foreground">Latest suggestions</p>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={mergeSuggestionsIntoPins}>
                        Add all to pins
                      </Button>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {suggestions.map((s) => (
                        <li key={s.name} className="text-[11px] leading-relaxed">
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline"
                            onClick={() => togglePinnedSub(s.name)}
                          >
                            r/{s.name}
                          </button>
                          <span className="text-muted-foreground"> — {s.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {targetsHint ? (
              <p className="mt-3 text-[11px] text-muted-foreground">{targetsHint}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-background/80 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Threads synthesized</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {loading && !data ? "..." : data?.conversationCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/80 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current lens</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {selectedSubreddit === "all" ? "All subreddits" : `r/${selectedSubreddit}`}
            </p>
            {selectedSubreddit === "all" && data?.synthesisCombined ? (
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                One synthesis across every subreddit in the batch below (not separate summaries per sub).
              </p>
            ) : null}
            {selectedSubreddit === "all" && (data?.subredditsInSynthesisBatch?.length ?? 0) > 0 ? (
              <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                In this batch:{" "}
                {(data?.subredditsInSynthesisBatch ?? [])
                  .slice(0, 10)
                  .map((s) => `r/${s}`)
                  .join(", ")}
                {(data?.subredditsInSynthesisBatch ?? []).length > 10
                  ? ` +${(data?.subredditsInSynthesisBatch ?? []).length - 10} more`
                  : ""}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-border bg-background/80 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Latest thread</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{formatRelative(data?.latestThreadAt)}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/80 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Summary source</p>
            <p className="mt-1 text-sm font-semibold capitalize text-foreground">
              {data?.summarySource ?? "live"}
            </p>
          </div>
        </div>

        {(error || scanHint) && (
          <div className="mt-4">
            {error ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                {error}
              </p>
            ) : null}
            {!error && scanHint ? (
              <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300">
                {scanHint}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-6 px-4 py-5 sm:px-5">
        {loading && !data ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/15 px-4 py-5 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Reddit customer research...
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
              <div className="rounded-xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Overview</p>
                    <h3 className="mt-1 text-base font-semibold text-foreground">
                      What {data.companyName || "buyers"} are telling us
                    </h3>
                  </div>
                  {data.selectedSubreddit ? (
                    <Badge variant="outline" className="text-[11px]">
                      r/{data.selectedSubreddit}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px]">
                      Cross-subreddit view
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-foreground/90">{data.overview}</p>

                {data.themes.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {data.themes.map((theme) => (
                      <div key={theme.title} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                        <p className="text-[12px] font-medium text-foreground">{theme.title}</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{theme.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-border bg-background/80 p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sentiment and grounding</p>
                <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{data.sentiment}</p>

                <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <p className="text-[12px] font-medium text-foreground">Context in play</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {data.contextSources.map((source) => (
                      <Badge key={source} variant="outline" className="text-[10px] font-medium">
                        {source}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Context refreshed {formatRelative(data.contextLastSyncedAt)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {data.vaultConnected
                      ? "Vault-backed grounding is connected."
                      : "Connect the GitHub-backed vault to deepen the synthesis."}
                  </p>
                  <Link
                    href="/dashboard/context"
                    className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80"
                  >
                    Open context
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Ask the data */}
            <div className="rounded-xl border border-border bg-background/80 p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ask the data</p>
              <p className="mt-1 text-[13px] font-medium text-foreground">Search Reddit conversations with a question</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Ask anything about what you have collected — buying stages, company types, objections, pricing signals.
              </p>
              <div className="mt-3 flex gap-2">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void askQuestion() }}
                  placeholder="e.g. At what stage are companies buying audit services?"
                  className="h-9 text-[13px]"
                  disabled={querying}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void askQuestion()}
                  disabled={querying || !question.trim()}
                  className="shrink-0 gap-2"
                >
                  {querying ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                  {querying ? "Searching…" : "Ask"}
                </Button>
              </div>

              {queryError ? (
                <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                  {queryError}
                </p>
              ) : null}

              {queryResult ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="text-[12px] font-medium text-foreground">Answer</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{queryResult.answer}</p>
                    {queryResult.keyFindings.length > 0 ? (
                      <ul className="mt-3 space-y-1.5">
                        {queryResult.keyFindings.map((finding) => (
                          <li key={finding} className="flex items-start gap-2 text-[12px] leading-relaxed text-foreground/85">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            {finding}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Searched {queryResult.signalsSearched} stored Reddit threads
                    </p>
                  </div>

                  {queryResult.threads.length > 0 ? (
                    <div>
                      <p className="mb-2 text-[12px] font-medium text-foreground">Evidence threads</p>
                      <div className="space-y-2">
                        {queryResult.threads.map((thread) => (
                          <div key={thread.url} className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
                            <a
                              href={thread.url}
                              target="_blank"
                              rel="noreferrer"
                              className="group inline-flex items-start gap-1 text-[12px] font-medium text-foreground hover:text-primary hover:underline"
                            >
                              <span>{thread.title}</span>
                              <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground group-hover:text-primary" />
                            </a>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {thread.subreddit ? (
                                <a href={`https://reddit.com/r/${thread.subreddit}`} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">
                                  r/{thread.subreddit}
                                </a>
                              ) : null}
                              {thread.relevance_score != null ? <span>{thread.relevance_score}/10</span> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <Accordion type="single" collapsible defaultValue="switching-forces" className="rounded-xl border border-border bg-background/80 shadow-sm">
              <AccordionItem value="switching-forces" className="border-none">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="text-left">
                    <p className="text-[13px] font-semibold text-foreground">Switching forces</p>
                    <p className="text-[11px] text-muted-foreground">Push, pull, anxiety, and allegiance</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <ResearchListCard title="Push of the present" description="What is painful enough about the current way that buyers want out." items={data.pushOfPresent} icon={ShieldAlert} accordionValue="push" />
                    <ResearchListCard title="Pull of the new" description="What a new solution promises that feels exciting or relieving." items={data.pullOfNew} icon={Sparkles} accordionValue="pull" />
                    <ResearchListCard title="Anxiety of the new" description="What could make them hesitate even when the old workflow is painful." items={data.anxietyOfNew} icon={Filter} accordionValue="anxiety" />
                    <ResearchListCard title="Allegiance to the old" description="What keeps them loyal to the current stack, habits, or process." items={data.allegianceToOld} icon={Wrench} accordionValue="allegiance" />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion type="single" collapsible defaultValue="operations" className="rounded-xl border border-border bg-background/80 shadow-sm">
              <AccordionItem value="operations" className="border-none">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="text-left">
                    <p className="text-[13px] font-semibold text-foreground">How they operate today</p>
                    <p className="text-[11px] text-muted-foreground">Current solutions, friction, and workarounds</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid gap-3 xl:grid-cols-3">
                    <ResearchListCard title="How they solve it today" description="Current stack, process, and makeshift operating system." items={data.currentSolutions} icon={Wrench} accordionValue="solutions" />
                    <ResearchListCard title="Friction points" description="Where the current process breaks down or feels disproportionately costly." items={data.frictionPoints} icon={ShieldAlert} accordionValue="friction" />
                    <ResearchListCard title="Workarounds" description="The hacks, patches, and backup systems they built to survive." items={data.workarounds} icon={MessageCircle} accordionValue="workarounds" />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion type="single" collapsible defaultValue="buying" className="rounded-xl border border-border bg-background/80 shadow-sm">
              <AccordionItem value="buying" className="border-none">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="text-left">
                    <p className="text-[13px] font-semibold text-foreground">Buying behaviour</p>
                    <p className="text-[11px] text-muted-foreground">Discovery, evaluation, pain points, and gains</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid gap-3 xl:grid-cols-4">
                    <ResearchListCard title="Discovery paths" description="How they find new products, peers, or alternatives." items={data.discoveryPaths} icon={Search} accordionValue="discovery" />
                    <ResearchListCard title="Buying process" description="How evaluation and internal buy-in seem to happen." items={data.buyingProcess} icon={Filter} accordionValue="buyingprocess" />
                    <ResearchListCard title="Pain points" description="What keeps them up at night and makes the problem feel urgent." items={data.painPoints} icon={ShieldAlert} accordionValue="pain" />
                    <ResearchListCard title="Gains" description="What success looks like when the workflow finally works." items={data.gains} icon={TrendingUp} accordionValue="gains" />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion type="single" collapsible defaultValue="evidence" className="rounded-xl border border-border bg-background/80 shadow-sm">
              <AccordionItem value="evidence" className="border-none">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex w-full items-center justify-between pr-2 text-left">
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">Threads behind the synthesis</p>
                      <p className="text-[11px] text-muted-foreground">Latest evidence from Reddit</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {data.threads.length} shown
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  {data.threads.length > 0 ? (
                    data.threads.map((thread) => (
                      <div key={thread.id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <a
                              href={thread.url}
                              target="_blank"
                              rel="noreferrer"
                              className="group inline-flex items-start gap-1 text-[12px] font-medium text-foreground hover:text-primary hover:underline"
                            >
                              <span>{thread.title}</span>
                              <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground group-hover:text-primary" />
                            </a>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                              <a
                                href={`https://reddit.com/r/${thread.subreddit}`}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-foreground hover:underline"
                              >
                                {thread.subreddit ? `r/${thread.subreddit}` : "reddit"}
                              </a>
                              <span>{thread.signal_type.replace(/_/g, " ")}</span>
                              <span>{thread.relevance_score ?? "?"}/10</span>
                              <span>{formatRelative(thread.discovered_at)}</span>
                            </div>
                          </div>
                        </div>

                        {thread.body ? (
                          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                            {stripPreview(thread.body)}
                          </p>
                        ) : null}

                        {thread.why_relevant ? (
                          <p className="mt-2 text-[12px] leading-relaxed text-foreground/90">
                            {thread.why_relevant}
                          </p>
                        ) : null}

                        {thread.matched_keywords?.length ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {thread.matched_keywords.slice(0, 4).map((keyword) => (
                              <Badge key={`${thread.id}-${keyword}`} variant="outline" className="text-[10px]">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-4 text-[12px] text-muted-foreground">
                      No Reddit threads are loaded for this lens yet.
                    </div>
                  )}
                </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion type="single" collapsible defaultValue="nextmoves" className="rounded-xl border border-border bg-background/80 shadow-sm">
              <AccordionItem value="nextmoves" className="border-none">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="text-left">
                    <p className="text-[13px] font-semibold text-foreground">Next moves</p>
                    <p className="text-[11px] text-muted-foreground">What to do with this research</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <ul className="space-y-2">
                    {data.nextMoves.length > 0 ? (
                      data.nextMoves.map((move) => (
                        <li key={move} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[12px] leading-relaxed text-foreground/90">
                          {move}
                        </li>
                      ))
                    ) : (
                      <li className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-2 text-[12px] text-muted-foreground">
                        Next-step recommendations will appear here after the next synthesis.
                      </li>
                    )}
                  </ul>
                  <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="text-[12px] font-medium text-foreground">How to use this panel</p>
                    <ul className="mt-2 space-y-2 text-[12px] leading-relaxed text-muted-foreground">
                      <li>Use the cross-subreddit view to understand recurring buying triggers.</li>
                      <li>Switch to one subreddit like r/CFO to isolate a tighter buyer narrative.</li>
                      <li>Turn repeated friction into messaging, roadmap hypotheses, and interview prompts.</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        ) : null}
      </div>
    </section>
  )
}

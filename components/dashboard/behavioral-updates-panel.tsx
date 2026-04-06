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
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  threads: BehavioralThread[]
  summarySource: "cached" | "live"
  generatedAt: string
}

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
}: {
  title: string
  description: string
  items: string[]
  icon: typeof Brain
}) {
  const Icon = icon

  return (
    <div className="rounded-xl border border-border bg-background/80 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
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
    </div>
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
  const pollRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const loadData = useCallback(
    async (subredditValue: string, showSpinner = false) => {
      if (showSpinner) setRefreshing(true)
      if (!showSpinner) setLoading(true)
      setError(null)

      try {
        const query =
          subredditValue && subredditValue !== "all"
            ? `?subreddit=${encodeURIComponent(subredditValue)}`
            : ""
        const res = await fetch(`/api/intelligence/behavioral-updates${query}`, {
          cache: "no-store",
        })
        const json = (await res.json().catch(() => ({}))) as BehavioralUpdatesResponse

        if (!res.ok || !json.data) {
          throw new Error(typeof json.error === "string" ? json.error : "Could not load behavioral updates.")
        }

        setData(json.data)
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

  return (
    <section
      id="behavioral-updates"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ResearchListCard
                title="Push of the present"
                description="What is painful enough about the current way that buyers want out."
                items={data.pushOfPresent}
                icon={ShieldAlert}
              />
              <ResearchListCard
                title="Pull of the new"
                description="What a new solution promises that feels exciting or relieving."
                items={data.pullOfNew}
                icon={Sparkles}
              />
              <ResearchListCard
                title="Anxiety of the new"
                description="What could make them hesitate even when the old workflow is painful."
                items={data.anxietyOfNew}
                icon={Filter}
              />
              <ResearchListCard
                title="Allegiance to the old"
                description="What keeps them loyal to the current stack, habits, or process."
                items={data.allegianceToOld}
                icon={Wrench}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <ResearchListCard
                title="How they solve it today"
                description="Current stack, process, and makeshift operating system."
                items={data.currentSolutions}
                icon={Wrench}
              />
              <ResearchListCard
                title="Friction points"
                description="Where the current process breaks down or feels disproportionately costly."
                items={data.frictionPoints}
                icon={ShieldAlert}
              />
              <ResearchListCard
                title="Workarounds"
                description="The hacks, patches, and backup systems they built to survive."
                items={data.workarounds}
                icon={MessageCircle}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-4">
              <ResearchListCard
                title="Discovery paths"
                description="How they find new products, peers, or alternatives."
                items={data.discoveryPaths}
                icon={Search}
              />
              <ResearchListCard
                title="Buying process"
                description="How evaluation and internal buy-in seem to happen."
                items={data.buyingProcess}
                icon={Filter}
              />
              <ResearchListCard
                title="Pain points"
                description="What keeps them up at night and makes the problem feel urgent."
                items={data.painPoints}
                icon={ShieldAlert}
              />
              <ResearchListCard
                title="Gains"
                description="What success looks like when the workflow finally works."
                items={data.gains}
                icon={TrendingUp}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Latest evidence</p>
                    <h3 className="mt-1 text-base font-semibold text-foreground">Threads behind the synthesis</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {data.threads.length} shown
                  </Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {data.threads.length > 0 ? (
                    data.threads.map((thread) => (
                      <div key={thread.id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[12px] font-medium text-foreground">{thread.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                              <span>{thread.subreddit ? `r/${thread.subreddit}` : "reddit"}</span>
                              <span>{thread.signal_type.replace(/_/g, " ")}</span>
                              <span>{thread.relevance_score ?? "?"}/10</span>
                              <span>{formatRelative(thread.discovered_at)}</span>
                            </div>
                          </div>
                          <a
                            href={thread.url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={`Open ${thread.title}`}
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </a>
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
              </div>

              <div className="rounded-xl border border-border bg-background/80 p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">What to do with this</p>
                <h3 className="mt-1 text-base font-semibold text-foreground">Next moves</h3>
                <ul className="mt-4 space-y-2">
                  {data.nextMoves.length > 0 ? (
                    data.nextMoves.map((move) => (
                      <li
                        key={move}
                        className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[12px] leading-relaxed text-foreground/90"
                      >
                        {move}
                      </li>
                    ))
                  ) : (
                    <li className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-2 text-[12px] text-muted-foreground">
                      Next-step recommendations will appear here after the next synthesis.
                    </li>
                  )}
                </ul>

                <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <p className="text-[12px] font-medium text-foreground">How to use this panel</p>
                  <ul className="mt-2 space-y-2 text-[12px] leading-relaxed text-muted-foreground">
                    <li>Use the cross-subreddit view to understand recurring buying triggers.</li>
                    <li>Switch to one subreddit like `r/CFO` to isolate a tighter buyer narrative.</li>
                    <li>Turn repeated friction into messaging, roadmap hypotheses, and interview prompts.</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}

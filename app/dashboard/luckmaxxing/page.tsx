"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  Briefcase,
  Compass,
  ExternalLink,
  Github,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Rss,
  Sparkles,
  Trash2,
} from "lucide-react"
import { REDDIT_SUBREDDITS } from "@/lib/juno/intent-keywords"
import { SOURCES } from "@/lib/juno/sources"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
}

const sections = [
  {
    icon: Compass,
    title: "Ecosystem opportunities",
    body: "Grants, accelerators, partnerships, and events worth your time. We will wire this to your context and signals.",
  },
  {
    icon: Rocket,
    title: "Applications",
    body: "Deadlines and links for programs you care about. One place to track what you opened and what you shipped.",
  },
  {
    icon: Briefcase,
    title: "Jobs & roles",
    body: "High-signal roles, ecosystem openings, and buyer hiring moves that match your thesis and stage.",
  },
  {
    icon: Sparkles,
    title: "Everything else",
    body: "Hacks, intros, communities, and small bets that stack surface area. This is the luck engine.",
  },
] as const

const actionableSourceGroups = [
  {
    title: "Hiring and buyer-demand feeds",
    description: "Open roles and public demand signals are the most directly usable luck surface here.",
    names: [
      ...SOURCES.filter((source) => source.category === "jobs").map((source) => source.name),
      "Hacker News Who's Hiring",
      "Reddit intent scan",
      "X watchlist search",
    ],
  },
  {
    title: "What counts as a real opening",
    description: "Luckmaxxing should highlight openings you can move on, not broad market news.",
    names: ["Hiring", "Hackathons", "Accelerators", "Grants", "Events", "Partnerships"],
  },
  {
    title: "Still to wire",
    description: "These are the next high-signal sources to add so the page gets even more useful.",
    names: ["Accelerator deadlines", "Grant programs", "Hackathon calendars", "Startup event feeds"],
  },
] as const

const accountIntegrations = [
  {
    title: "GitHub via Pipedream Connect",
    body: "Live in the Integrations page today. Used for repo access, security scans, and vault-linked workflows.",
  },
  {
    title: "Obsidian vault via GitHub",
    body: "Live in Context. Juno reads your GitHub-backed vault and uses it to ground chat and agent work.",
  },
] as const

const gaps = [
  "LinkedIn mention tracking is still not wired, so buyer pain that only appears there will be missed for now.",
  "X monitoring depends on X_BEARER_TOKEN being configured and only covers public posts via recent search.",
  "Luckmaxxing still needs alerts, reminders, and a tighter follow-up queue after a strong signal is found.",
] as const

const ACTIONABLE_OPENING_TYPES = ["Hiring", "Hackathons", "Accelerators", "Grants", "Events", "Partnerships"] as const

type TriggerPipeline = "cbs" | "intent" | "cro"

type IntelligenceFeedSnapshot = {
  pipelineStatus?: {
    cbs?: string | null
    cro?: string | null
    cmo?: string | null
    cto?: string | null
  }
  brief?: {
    created_at?: string
    content?: {
      markdown?: string
      dashboard?: BriefDashboard
    }
  } | null
  leads?: LeadRow[]
}

type IntentSignalRow = {
  id: string
  platform: string
  signal_type: string
  title: string
  url: string
  why_relevant: string | null
  urgency: string | null
  relevance_score: number | null
  discovered_at: string
  matched_keywords: string[] | null
}

type BriefDashboardItem = {
  title?: string
  source?: string
  url?: string
  score?: number
  urgency?: string
  category?: string
  whyItMatters?: string
  strategicImplication?: string
  suggestedAction?: string
  connectionToRoadmap?: string | null
}

type BriefDashboard = {
  breaking?: BriefDashboardItem[]
  ai_tools?: BriefDashboardItem[]
  research?: BriefDashboardItem[]
  competitors?: BriefDashboardItem[]
  funding?: BriefDashboardItem[]
}

type LeadRow = {
  id: string
  created_at: string
  content?: {
    company?: unknown
    role?: unknown
    url?: unknown
    score?: unknown
    pitchAngle?: unknown
    body?: string
  }
}

type WatchlistSnapshot = {
  watchTerms: string[]
  suggestions: string[]
  xReady: boolean
  limit: number
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Not yet"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return "Not yet"
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

type ActionableOpening = {
  key: string
  title: string
  source: string
  why: string
  action: string
  url: string | null
  kind: string
  scoreLabel: string
}

const ACTIONABLE_SIGNAL_RE =
  /\b(hiring|job opening|open role|recruiting|who is hiring|hackathon|accelerator|incubator|grant|fellowship|deadline|apply|application|program|cohort|demo day|pitch competition|conference|summit|meetup|webinar|event|partnership|partner program|pilot|rfp)\b/i

const NON_ACTIONABLE_NEWS_RE =
  /\b(going public|ipo|acquisition|acquired|valuation|earnings|stock price|sec filing)\b/i

function isActionableOpportunityText(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return false
  if (ACTIONABLE_SIGNAL_RE.test(normalized)) return true
  if (NON_ACTIONABLE_NEWS_RE.test(normalized)) return false
  return false
}

function deriveActionableOpenings(snapshot: IntelligenceFeedSnapshot | null): ActionableOpening[] {
  if (!snapshot) return []

  const openings: ActionableOpening[] = []
  const seen = new Set<string>()

  for (const lead of snapshot.leads ?? []) {
    const company = String(lead.content?.company ?? "").trim()
    const role = String(lead.content?.role ?? "").trim()
    const url = typeof lead.content?.url === "string" ? lead.content.url : null
    if (!company || !role) continue

    const key = `${company}\0${role}`
    if (seen.has(key)) continue
    seen.add(key)

    openings.push({
      key,
      title: `${company} is hiring for ${role}`,
      source: "Hiring signal",
      why:
        String(lead.content?.pitchAngle ?? "").trim() ||
        String(lead.content?.body ?? "").trim().slice(0, 220) ||
        "A live role is often the clearest public signal that a company has budget and urgency in this area.",
      action: "Review the opening and decide whether this is an intro, outreach, or customer-development target.",
      url,
      kind: "hiring",
      scoreLabel:
        typeof lead.content?.score === "number" ? `${Math.round(lead.content.score)}/10 fit` : "live role",
    })
  }

  const dashboardItems = [
    ...(snapshot.brief?.content?.dashboard?.breaking ?? []),
    ...(snapshot.brief?.content?.dashboard?.ai_tools ?? []),
    ...(snapshot.brief?.content?.dashboard?.research ?? []),
    ...(snapshot.brief?.content?.dashboard?.competitors ?? []),
    ...(snapshot.brief?.content?.dashboard?.funding ?? []),
  ]

  for (const item of dashboardItems) {
    const title = String(item.title ?? "").trim()
    const why = String(item.whyItMatters ?? "").trim()
    const action = String(item.suggestedAction ?? "").trim()
    const implication = String(item.strategicImplication ?? "").trim()
    const combined = [title, why, action, implication].filter(Boolean).join("\n")
    if (!isActionableOpportunityText(combined)) continue

    const key = `${String(item.url ?? title)}\0${title}`
    if (seen.has(key)) continue
    seen.add(key)

    openings.push({
      key,
      title,
      source: String(item.source ?? "Public signal"),
      why: why || implication || "This looks like a public opening you can act on.",
      action: action || "Open the source and decide whether to apply, reach out, or track the deadline.",
      url: typeof item.url === "string" ? item.url : null,
      kind: String(item.category ?? "opportunity"),
      scoreLabel:
        typeof item.score === "number"
          ? `${Math.round(item.score)}/10`
          : String(item.urgency ?? "actionable"),
    })
  }

  return openings.slice(0, 8)
}

export default function LuckmaxxingPage() {
  const { toast } = useToast()
  const [snapshot, setSnapshot] = useState<IntelligenceFeedSnapshot | null>(null)
  const [intentSignals, setIntentSignals] = useState<IntentSignalRow[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistSnapshot | null>(null)
  const [loadingSnapshot, setLoadingSnapshot] = useState(true)
  const [refreshingSnapshot, setRefreshingSnapshot] = useState(false)
  const [runningPipeline, setRunningPipeline] = useState<TriggerPipeline | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [lastQueuedLabel, setLastQueuedLabel] = useState<string | null>(null)
  const [watchTermDraft, setWatchTermDraft] = useState("")
  const [savingWatchTerm, setSavingWatchTerm] = useState(false)
  const [removingWatchTerm, setRemovingWatchTerm] = useState<string | null>(null)

  const watchTerms = watchlist?.watchTerms ?? []
  const xReady = Boolean(watchlist?.xReady)
  const publicMentionCoverage = 2 + (xReady ? 1 : 0)
  const latestSignalSeenAt = intentSignals[0]?.discovered_at ?? null
  const actionableOpenings = deriveActionableOpenings(snapshot)

  function scheduleSnapshotRefresh() {
    window.setTimeout(() => {
      void loadSnapshot(true)
    }, 3500)

    window.setTimeout(() => {
      void loadSnapshot()
    }, 12000)
  }

  async function triggerPipeline(pipeline: TriggerPipeline) {
    const res = await fetch("/api/intelligence/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pipeline }),
    })

    const json = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      throw new Error(json.error || "Could not queue the scan.")
    }
  }

  async function loadSnapshot(showSpinner = false) {
    if (showSpinner) setRefreshingSnapshot(true)
    try {
      const [feedRes, signalsRes, watchlistRes] = await Promise.all([
        fetch("/api/intelligence/feed", { credentials: "include" }),
        fetch("/api/intelligence/intent-signals", { credentials: "include" }),
        fetch("/api/luckmaxxing/watchlist", { credentials: "include" }),
      ])

      const feedJson = (await feedRes.json().catch(() => ({}))) as IntelligenceFeedSnapshot & { error?: string }
      const signalsJson = (await signalsRes.json().catch(() => ({}))) as {
        signals?: IntentSignalRow[]
        error?: string
      }
      const watchlistJson = (await watchlistRes.json().catch(() => ({}))) as WatchlistSnapshot & { error?: string }

      if (!feedRes.ok) {
        throw new Error(feedJson.error || "Could not load intelligence feed.")
      }

      if (!signalsRes.ok) {
        throw new Error(signalsJson.error || "Could not load intent signals.")
      }

      if (!watchlistRes.ok) {
        throw new Error(watchlistJson.error || "Could not load watch terms.")
      }

      setSnapshot(feedJson)
      setIntentSignals(Array.isArray(signalsJson.signals) ? signalsJson.signals.slice(0, 8) : [])
      setWatchlist({
        watchTerms: Array.isArray(watchlistJson.watchTerms) ? watchlistJson.watchTerms : [],
        suggestions: Array.isArray(watchlistJson.suggestions) ? watchlistJson.suggestions : [],
        xReady: Boolean(watchlistJson.xReady),
        limit: Number(watchlistJson.limit ?? 24) || 24,
      })
    } catch (error) {
      toast({
        title: "Could not load scan results",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setLoadingSnapshot(false)
      setRefreshingSnapshot(false)
    }
  }

  useEffect(() => {
    void loadSnapshot()
  }, [])

  async function runScan(pipeline: TriggerPipeline, label: string) {
    setRunningPipeline(pipeline)
    try {
      await triggerPipeline(pipeline)
      setLastQueuedLabel(label)
      toast({
        title: `${label} queued`,
        description: "Juno is running it now. Results on this page will refresh automatically.",
      })
      scheduleSnapshotRefresh()
    } catch (error) {
      toast({
        title: "Could not start scan",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setRunningPipeline(null)
    }
  }

  async function syncAll() {
    setSyncingAll(true)
    try {
      await triggerPipeline("cbs")
      await triggerPipeline("intent")
      await triggerPipeline("cro")

      setLastQueuedLabel("Full sync")
      toast({
        title: "Full sync queued",
        description: "Ecosystem, mentions, and jobs are updating now.",
      })
      scheduleSnapshotRefresh()
    } catch (error) {
      toast({
        title: "Could not start full sync",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setSyncingAll(false)
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
      if (!res.ok) {
        throw new Error(json.error || "Could not save the watch term.")
      }

      setWatchlist({
        watchTerms: Array.isArray(json.watchTerms) ? json.watchTerms : [],
        suggestions: Array.isArray(json.suggestions) ? json.suggestions : [],
        xReady: Boolean(json.xReady),
        limit: Number(json.limit ?? 24) || 24,
      })
      setWatchTermDraft("")
      toast({
        title: "Watch term saved",
        description: `"${term}" will be included the next time mentions are scanned.`,
      })
    } catch (error) {
      toast({
        title: "Could not save watch term",
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
      if (!res.ok) {
        throw new Error(json.error || "Could not remove the watch term.")
      }

      setWatchlist({
        watchTerms: Array.isArray(json.watchTerms) ? json.watchTerms : [],
        suggestions: Array.isArray(json.suggestions) ? json.suggestions : [],
        xReady: Boolean(json.xReady),
        limit: Number(json.limit ?? 24) || 24,
      })
      toast({
        title: "Watch term removed",
        description: `"${term}" is no longer part of the X monitoring list.`,
      })
    } catch (error) {
      toast({
        title: "Could not remove watch term",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setRemovingWatchTerm(null)
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-6 p-6 lg:p-8 max-w-4xl mx-auto"
    >
      <motion.div variants={item} className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Surface area</p>
          <h1 className="text-2xl font-semibold text-foreground">Luckmaxxing</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Stack the odds: ecosystem openings, applications, jobs, and other moves that increase your luck. You will
            curate here; Juno will help fill it from your company profile and intelligence feed.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void syncAll()}
          disabled={syncingAll || runningPipeline !== null || refreshingSnapshot}
          className="gap-2 md:mt-1"
        >
          {syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync now
        </Button>
      </motion.div>

      <motion.section variants={item} className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold text-foreground">Scan Right Now</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Run the current pipelines on demand: ecosystem RSS, public mentions, and job signals. The mentions scan
              always checks Reddit and Hacker News, and it also checks X when the search token is configured.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadSnapshot(true)}
            disabled={refreshingSnapshot || loadingSnapshot}
            className="gap-2"
          >
            {refreshingSnapshot ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh results
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void runScan("cbs", "Ecosystem scan")}
            disabled={runningPipeline !== null}
            className="gap-2"
          >
            {runningPipeline === "cbs" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rss className="h-4 w-4" />}
            Scan ecosystem now
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void runScan("intent", "Mentions scan")}
            disabled={runningPipeline !== null}
            className="gap-2"
          >
            {runningPipeline === "intent" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
            Scan mentions now
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void runScan("cro", "Jobs scan")}
            disabled={runningPipeline !== null}
            className="gap-2"
          >
            {runningPipeline === "cro" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
            Scan jobs now
          </Button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground">Last ecosystem run</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {formatDateTime(snapshot?.pipelineStatus?.cbs ?? null)}
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground">Last jobs run</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {formatDateTime(snapshot?.pipelineStatus?.cro ?? null)}
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground">X watch terms</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {loadingSnapshot ? "Loading..." : `${watchTerms.length}/${watchlist?.limit ?? 24}`}
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground">Latest mention seen</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {formatDateTime(latestSignalSeenAt)}
            </div>
          </div>
        </div>

        <p className="mt-3 text-[12px] text-muted-foreground">
          {lastQueuedLabel
            ? `${lastQueuedLabel} was queued. If the results do not change immediately, give the worker a few seconds and refresh again.`
            : "Manual scan buttons send work to the same Juno pipelines already used by the scheduled feed."}
        </p>
      </motion.section>

      <motion.section variants={item} className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold text-foreground">X Opportunity Watchlist</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Add the companies, products, or phrases you want Juno to look for on X. Examples: a competitor name, a
              product category, or a specific pain phrase like "cofounder tool."
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
            {xReady ? "X search ready" : "Set X_BEARER_TOKEN to turn on X scanning"}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="text"
              value={watchTermDraft}
              onChange={(event) => setWatchTermDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void addWatchTerm()
                }
              }}
              placeholder='Add a company, account, or phrase to watch, e.g. "General Intelligence"'
              className="h-10 flex-1 text-sm"
            />
            <Button
              type="button"
              onClick={() => void addWatchTerm()}
              disabled={savingWatchTerm || !watchTermDraft.trim()}
              className="gap-2"
            >
              {savingWatchTerm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add watch term
            </Button>
          </div>

          {watchlist?.suggestions?.length ? (
            <div className="flex flex-wrap gap-2">
              {watchlist.suggestions
                .filter((term) => !watchTerms.some((value) => value.toLowerCase() === term.toLowerCase()))
                .slice(0, 6)
                .map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => void addWatchTerm(term)}
                    disabled={savingWatchTerm}
                    className="rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-muted"
                  >
                    + {term}
                  </button>
                ))}
            </div>
          ) : null}

          {loadingSnapshot ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading watch terms...
            </div>
          ) : watchTerms.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              No saved watch terms yet. Add the companies or topics you want Luckmaxxing to monitor before you run the
              mentions scan.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {watchTerms.map((term) => (
                <span
                  key={term}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/20 px-2 py-1 text-[12px] text-foreground"
                >
                  <span>{term}</span>
                  <button
                    type="button"
                    onClick={() => void removeWatchTerm(term)}
                    disabled={removingWatchTerm === term}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    title={`Remove ${term}`}
                  >
                    {removingWatchTerm === term ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      <motion.ul variants={item} className="grid gap-3 sm:grid-cols-2">
        {sections.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 text-foreground">
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[13px] font-semibold">{title}</span>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{body}</p>
          </li>
        ))}
      </motion.ul>

      <motion.section variants={item} className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">Signal Coverage Right Now</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            This page is now biased toward openings you can act on, not broad market chatter. These are the public
            signal lanes Luckmaxxing can use today.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-foreground">
              <Rss className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[13px] font-semibold">Actionable filters</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{ACTIONABLE_OPENING_TYPES.length}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Generic startup and funding headlines are intentionally down-ranked here unless they create one of these
              usable opening types.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-foreground">
              <Radio className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[13px] font-semibold">Public mention scans</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{publicMentionCoverage}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Reddit and Hacker News are live today, and X joins that coverage when the search token is configured.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-foreground">
              <Github className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[13px] font-semibold">Account integrations</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{accountIntegrations.length}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              GitHub account connection and GitHub-backed Obsidian vault access are both live.
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section variants={item} className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Compass className="h-4 w-4 text-primary shrink-0" />
            <h2 className="text-[13px] font-semibold">Actionable Openings</h2>
          </div>
          <div className="mt-3 space-y-3">
            {loadingSnapshot ? (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading openings...
              </div>
            ) : actionableOpenings.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                No actionable openings yet. Luckmaxxing will only surface items that look usable, like hiring signals,
                accelerators, grants, hackathons, events, or partnerships.
              </p>
            ) : (
              actionableOpenings.map((opening) => (
                <div key={opening.key} className="rounded-md border border-border bg-muted/15 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground">{opening.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {opening.source} / {opening.kind} / {opening.scoreLabel}
                      </p>
                    </div>
                    {opening.url ? (
                      <a
                        href={opening.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title="Open source"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{opening.why}</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-foreground">{opening.action}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Radio className="h-4 w-4 text-primary shrink-0" />
            <h2 className="text-[13px] font-semibold">Latest Public Signals</h2>
          </div>
          <div className="mt-3 space-y-3">
            {loadingSnapshot ? (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading public signals...
              </div>
            ) : intentSignals.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                No saved public mention signals yet. Run "Scan mentions now" to look across Reddit, Hacker News, and X
                when it is configured.
              </p>
            ) : (
              intentSignals.map((signal) => (
                <div key={signal.id} className="rounded-md border border-border bg-muted/15 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground">{signal.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {signal.platform.toUpperCase()} / {signal.signal_type.replace(/_/g, " ")} /{" "}
                        {signal.relevance_score ?? "?"}/10
                      </p>
                    </div>
                    <a
                      href={signal.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      title="Open source"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  {signal.why_relevant ? (
                    <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{signal.why_relevant}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{signal.urgency ?? "monitor"}</span>
                    <span>{formatDateTime(signal.discovered_at)}</span>
                    {signal.matched_keywords?.slice(0, 3).map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.section>

      <motion.section variants={item} className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Rss className="h-4 w-4 text-primary shrink-0" />
            <h2 className="text-[13px] font-semibold">Actionable Source Coverage</h2>
          </div>
          <div className="mt-3 space-y-3">
            {actionableSourceGroups.map((group) => (
              <div key={group.title}>
                <p className="text-[12px] font-medium text-foreground">{group.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{group.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.names.map((name) => (
                    <span
                      key={name}
                      className="inline-flex rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Radio className="h-4 w-4 text-primary shrink-0" />
            <h2 className="text-[13px] font-semibold">Public Ecosystem Mentions</h2>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[12px] font-medium text-foreground">X recent search</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {xReady
                  ? "Juno can now scan public X posts for the watch terms saved above and feed relevant hits into the intent queue."
                  : "Configured next: set X_BEARER_TOKEN in the deployment environment and the mentions pipeline will include public X posts automatically."}
              </p>
            </div>

            <div>
              <p className="text-[12px] font-medium text-foreground">Reddit intent scan</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Juno scans public Reddit search plus key subreddits for posts where someone is asking for a tool,
                describing pain, or mentioning a competitor.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REDDIT_SUBREDDITS.map((subreddit) => (
                  <span
                    key={subreddit}
                    className="inline-flex rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground"
                  >
                    r/{subreddit}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[12px] font-medium text-foreground">Hacker News intent scan</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Juno scans HN stories and comments for keyword-matched buying signals and problem mentions every 6
                hours.
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-[12px] font-medium text-foreground">What this can catch today</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Posts like "we need a better cofounder workflow tool," "what are people using for X," or "we are
                replacing [competitor]" are now in scope across Reddit and HN, and on X once the token is set.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section variants={item} className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Github className="h-4 w-4 text-primary shrink-0" />
            <h2 className="text-[13px] font-semibold">Live Account Integrations</h2>
          </div>
          <div className="mt-3 space-y-3">
            {accountIntegrations.map((integration) => (
              <div key={integration.title}>
                <p className="text-[12px] font-medium text-foreground">{integration.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{integration.body}</p>
              </div>
            ))}
            <Link
              href="/dashboard/integrations"
              className="inline-flex text-[12px] font-medium text-primary hover:text-primary/80"
            >
              Open Integrations
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <h2 className="text-[13px] font-semibold">Gaps Blocking Better Luck Signals</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {gaps.map((gap) => (
              <li key={gap} className="text-[12px] leading-relaxed text-muted-foreground">
                {gap}
              </li>
            ))}
          </ul>
        </div>
      </motion.section>

      <motion.div
        variants={item}
        className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center"
      >
        <p className="text-sm text-muted-foreground">
          Luckmaxxing now has a real watchlist and can fold X into the mentions pipeline. The next useful step is
          LinkedIn coverage plus alerts so strong signals become faster follow-up.
        </p>
      </motion.div>
    </motion.div>
  )
}

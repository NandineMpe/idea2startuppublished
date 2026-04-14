"use client"

import { useEffect, useState, useCallback } from "react"
import { UserCircle, AlertTriangle, Zap, Target, TrendingUp, Clock, RefreshCw, FileText, Coffee } from "lucide-react"
import Link from "next/link"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FounderPublicPresencePanel } from "@/components/dashboard/founder-public-presence-panel"
import {
  loadFounderBrandState,
  saveFounderBrandState,
  type FounderBrandState,
} from "@/lib/founder-brand"
import type { CeoReviewData } from "@/lib/inngest/functions/cbs-ceo-review"

// ─── Manual-note tabs ─────────────────────────────────────────────

const BRAND_TAB_KEYS = [
  "pitchArticulation",
  "brandStrategies",
  "publicPresence",
  "credibilityProof",
  "founderLocation",
] as const

type FounderBrandTabKey = (typeof BRAND_TAB_KEYS)[number]

/** Tabs that use the long-form notes textarea (excludes public presence, which has its own panel). */
type BrandNotesTabKey = Exclude<FounderBrandTabKey, "publicPresence">

const TAB_HINT: Record<
  FounderBrandTabKey,
  { title: string; hint: string; placeholder: string }
> = {
  pitchArticulation: {
    title: "Pitch Notes",
    hint: "Your own pitch notes — elevator pitch, one-liners, investor and customer versions. The AI review above rewrites these daily based on what's actually working.",
    placeholder:
      "30-second version…\n\nOne sentence you want repeated…\n\nHow you differ from the obvious alternative…",
  },
  brandStrategies: {
    title: "Brand Strategy",
    hint: "How you will build and reinforce your founder brand over time — themes, campaigns, partnerships, and what you will not do.",
    placeholder:
      "North-star theme for the next 6–12 months…\n\nContent pillars or narratives…\n\nRisks to avoid (tone, topics, over-promising)…",
  },
  publicPresence: {
    title: "Public presence",
    hint: "TikTok digest, your scheduled topics (with links and media), then other channels: LinkedIn, talks, newsletter, podcast.",
    placeholder:
      "Primary channels and rough cadence (e.g. LinkedIn 2×/week)…\n\nFormats you enjoy vs. drain you…\n\nAudience you write for on each surface…",
  },
  credibilityProof: {
    title: "Credibility & Proof",
    hint: "Why people should listen — background, wins, logos, metrics, and third-party validation. Short beats CV-length.",
    placeholder:
      "2–3 proof points you want front and center…\n\nBio line for profiles and decks…\n\nSocial proof (customers, press, investors) you can name…",
  },
  founderLocation: {
    title: "Founder Location",
    hint: "Where you are based, time zones you work in, and markets you care about — useful for scheduling, travel, and local credibility.",
    placeholder:
      "City / region / country…\n\nTime zone(s) and typical working hours…\n\nMarkets you sell into or visit regularly…",
  },
}

// ─── CEO Review tab ───────────────────────────────────────────────

type ReviewState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "triggering" }
  | { status: "loaded"; review: { review_date: string; review_data: CeoReviewData } }
  | { status: "error"; message: string }

const INSIGHT_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  "10_star_product": {
    label: "10-Star Product",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    icon: <Zap className="h-3 w-3" />,
  },
  wrong_problem: {
    label: "Wrong Problem?",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  icp_drift: {
    label: "ICP Drift",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    icon: <Target className="h-3 w-3" />,
  },
  timing_window: {
    label: "Timing Window",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    icon: <Clock className="h-3 w-3" />,
  },
  leverage_point: {
    label: "Leverage Point",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    icon: <TrendingUp className="h-3 w-3" />,
  },
}

function CeoReviewPanel() {
  const [state, setState] = useState<ReviewState>({ status: "loading" })

  const load = useCallback(async () => {
    setState({ status: "loading" })
    try {
      const res = await fetch("/api/ceo-review")
      const json = (await res.json()) as { review: { review_date: string; review_data: CeoReviewData } | null; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to load")
      setState(json.review ? { status: "loaded", review: json.review } : { status: "empty" })
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Unknown error" })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function triggerReview() {
    setState({ status: "triggering" })
    try {
      const res = await fetch("/api/ceo-review", { method: "POST" })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to trigger")
      // Poll for the result after a brief delay
      setTimeout(() => void load(), 3000)
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Unknown error" })
    }
  }

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (state.status === "empty" || state.status === "triggering") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border py-16 text-center">
        <div className="text-4xl">🧠</div>
        <div>
          <p className="font-medium text-foreground">No strategic review yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Runs automatically at 6am daily. Or trigger one now.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status === "triggering"}
          onClick={() => void triggerReview()}
        >
          {state.status === "triggering" ? (
            <>
              <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
              Triggering…
            </>
          ) : (
            "Generate review now →"
          )}
        </Button>
        {state.status === "triggering" && (
          <p className="text-xs text-muted-foreground">
            Running in the background — this takes about 30 seconds. Refresh the page shortly.
          </p>
        )}
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {state.message}
      </div>
    )
  }

  const { review_date, review_data } = state.review
  const r = review_data

  const formattedDate = new Date(review_date + "T12:00:00Z").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  const scopeColors: Record<string, string> = {
    EXPAND: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    HOLD: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    REDUCE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Strategic Review · {formattedDate}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Updates daily at 6am</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Weekly assignment — top of mind */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-900/10">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          This week's assignment
        </p>
        <p className="text-sm font-medium text-foreground">{r.weeklyAssignment}</p>
      </div>

      {/* Pitch articulation */}
      <div>
        <h3 className="mb-3 text-[13px] font-semibold text-foreground">Pitch Articulation</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { label: "30-second version", value: r.pitchArticulation.thirtySecondVersion },
            { label: "One sentence", value: r.pitchArticulation.oneSentence },
            { label: "How you differ", value: r.pitchArticulation.howYouDiffer },
            { label: "Why now", value: r.pitchArticulation.whyNow },
          ].map(({ label, value }) => (
            <Card key={label} className="border-border bg-muted/30">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-[13px] leading-relaxed text-foreground">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Strategic insights */}
      {r.strategicInsights.length > 0 && (
        <div>
          <h3 className="mb-3 text-[13px] font-semibold text-foreground">Strategic Insights</h3>
          <div className="space-y-3">
            {r.strategicInsights.map((insight, i) => {
              const cfg = INSIGHT_TYPE_CONFIG[insight.type] ?? {
                label: insight.type,
                color: "bg-gray-100 text-gray-700",
                icon: null,
              }
              return (
                <Card key={i} className="border-border">
                  <CardContent className="pt-4 pb-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </div>
                    <p className="mb-1.5 text-[13px] font-medium leading-relaxed text-foreground">
                      {insight.insight}
                    </p>
                    <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
                      {insight.evidence}
                    </p>
                    <div className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-1 text-[12px] font-medium text-foreground">
                      → {insight.action}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Critical gaps */}
      {r.criticalGaps.length > 0 && (
        <div>
          <h3 className="mb-3 text-[13px] font-semibold text-foreground">Critical Gaps</h3>
          <div className="space-y-2">
            {r.criticalGaps.map((gap, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive/70" />
                <p className="text-[13px] text-foreground">{gap}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scope recommendation */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Scope recommendation
            </p>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${scopeColors[r.scopeRecommendation] ?? "bg-gray-100 text-gray-700"}`}
            >
              {r.scopeRecommendation}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-foreground">{r.scopeReasoning}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Design Docs panel ───────────────────────────────────────────

type DesignDocSummary = {
  id: string
  mode: string
  title: string
  doc_data: { theAssignment?: string; recommendedApproach?: string }
  status: string
  created_at: string
}

function DesignDocsPanel() {
  const [docs, setDocs] = useState<DesignDocSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/office-hours/design-doc?all=true")
      .then((r) => r.json())
      .then((data: { docs?: DesignDocSummary[] }) => setDocs(data.docs ?? []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
        <Coffee className="h-6 w-6 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">No design docs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete an Office Hours session to generate your first.
          </p>
        </div>
        <Link href="/dashboard/office-hours">
          <Button variant="outline" size="sm">
            <FileText className="mr-2 h-3.5 w-3.5" />
            Start Office Hours →
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {docs.map((doc) => (
        <Card key={doc.id} className="border-border">
          <CardContent className="py-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium text-foreground">{doc.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    doc.mode === "builder"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  }`}>
                    {doc.mode === "builder" ? "🛠 Builder" : "🔬 Startup"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <Link href="/dashboard/office-hours">
                <Button variant="ghost" size="sm" className="h-7 text-[12px]">
                  View →
                </Button>
              </Link>
            </div>
            {doc.doc_data.theAssignment && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-900/10">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Assignment</p>
                <p className="mt-0.5 text-[12px] text-foreground">{doc.doc_data.theAssignment}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export function FounderBrandPageContent() {
  const [data, setData] = useState<FounderBrandState>(() => loadFounderBrandState())

  useEffect(() => {
    saveFounderBrandState(data)
  }, [data])

  function patch(key: BrandNotesTabKey, value: string) {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <UserCircle className="h-5 w-5 text-muted-foreground" />
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Founder</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Founder brand</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Daily AI strategic review, plus your pitch notes, strategy, and presence.
        </p>
      </div>

      <Tabs defaultValue="strategicReview" className="w-full">
        <TabsList className="mb-1 flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-border bg-muted/40 p-1">
          <TabsTrigger
            value="strategicReview"
            className="rounded-md px-3 py-2 text-[12px] data-[state=active]:bg-background data-[state=active]:shadow-sm sm:text-[13px]"
          >
            Strategic Review
          </TabsTrigger>
          {BRAND_TAB_KEYS.map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              className="rounded-md px-3 py-2 text-[12px] data-[state=active]:bg-background data-[state=active]:shadow-sm sm:text-[13px]"
            >
              {TAB_HINT[key].title}
            </TabsTrigger>
          ))}
          <TabsTrigger
            value="designDocs"
            className="rounded-md px-3 py-2 text-[12px] data-[state=active]:bg-background data-[state=active]:shadow-sm sm:text-[13px]"
          >
            Design Docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="strategicReview" className="mt-4 focus-visible:outline-none">
          <CeoReviewPanel />
        </TabsContent>

        {BRAND_TAB_KEYS.map((key) => (
          <TabsContent key={key} value={key} className="mt-4 space-y-3 focus-visible:outline-none">
            {key === "publicPresence" ? (
              <FounderPublicPresencePanel
                hint={TAB_HINT.publicPresence.hint}
                placeholder={TAB_HINT.publicPresence.placeholder}
                data={data}
                setData={setData}
              />
            ) : (
              <>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{TAB_HINT[key].hint}</p>
                <div className="space-y-2">
                  <Label htmlFor={`fb-${key}`} className="sr-only">
                    {TAB_HINT[key].title}
                  </Label>
                  <Textarea
                    id={`fb-${key}`}
                    value={data[key]}
                    onChange={(e) => patch(key, e.target.value)}
                    placeholder={TAB_HINT[key].placeholder}
                    rows={14}
                    className="min-h-[280px] resize-y text-[13px] leading-relaxed"
                  />
                </div>
              </>
            )}
          </TabsContent>
        ))}

        <TabsContent value="designDocs" className="mt-4 focus-visible:outline-none">
          <DesignDocsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

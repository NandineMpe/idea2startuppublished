"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Instrument_Serif } from "next/font/google"
import {
  UserCircle,
  AlertTriangle,
  Zap,
  Target,
  TrendingUp,
  Clock,
  RefreshCw,
  FileText,
  Coffee,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
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
import { cn } from "@/lib/utils"

const editorialSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
})

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
    title: "Public presence + collabs",
    hint: "Intelligence feed, your scheduled topics (with links and media), then other channels: LinkedIn, talks, newsletter, podcast.",
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

const PITCH_EDITORIAL_PAGE_TITLES = [
  "Cover",
  "Problem",
  "Solution",
  "Features",
  "Audience",
  "Competition",
  "Origin Story",
  "Launch / Traction",
  "Tech",
  "Back Cover",
] as const

const PITCH_EDITORIAL_FALLBACK = {
  sourceLine: "The operating layer between finance teams and compliance work.",
  problemBullets: [
    "Senior finance staff still get pulled into repetitive standards research and review loops.",
    "Close cycles slow down when technical questions become manual coordination projects.",
    "Audit readiness turns into overtime, burnout, and expensive external patchwork.",
    "Weak readiness creates downstream costs when scrutiny arrives faster than documentation.",
  ],
}

type LatestCeoReview = {
  review_date: string
  review_data: CeoReviewData
}

type PitchEditorialSource = {
  sourceLine: string
  problemBullets: string[]
  hasCustomNotes: boolean
  thirtySecondVersion: string
  howYouDiffer: string
  whyNow: string
  weeklyAssignment: string
  scopeRecommendation: CeoReviewData["scopeRecommendation"] | null
  scopeReasoning: string
  lastUpdatedLabel: string | null
  hasDailyReview: boolean
}

function splitFounderNotes(notes: string) {
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function truncateFounderNote(value: string, max = 130) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

function normalizeFounderBullet(line: string) {
  return line.replace(/^[-*•]\s*/, "").trim()
}

function formatReviewDateLabel(reviewDate: string) {
  return new Date(`${reviewDate}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function buildPitchEditorialSource(notes: string, latestReview: LatestCeoReview | null): PitchEditorialSource {
  const lines = splitFounderNotes(notes)
  const bulletLines = lines.filter((line) => /^[-*•]\s*/.test(line)).map(normalizeFounderBullet)
  const fallbackSourceLine =
    lines.find((line) => !/^[-*•]\s*/.test(line) && !/^core insight:?$/i.test(line)) ??
    PITCH_EDITORIAL_FALLBACK.sourceLine

  const fallbackProblemBullets = [
    ...bulletLines,
    ...PITCH_EDITORIAL_FALLBACK.problemBullets.filter((fallback) => !bulletLines.includes(fallback)),
  ].slice(0, 4)

  const reviewData = latestReview?.review_data ?? null
  const reviewBullets =
    reviewData?.criticalGaps.filter((gap) => typeof gap === "string" && gap.trim().length > 0).slice(0, 4) ?? []
  const sourceLine = reviewData?.pitchArticulation.oneSentence?.trim() || fallbackSourceLine
  const thirtySecondVersion = reviewData?.pitchArticulation.thirtySecondVersion?.trim() || sourceLine
  const howYouDiffer =
    reviewData?.pitchArticulation.howYouDiffer?.trim() ||
    "Purpose-built for finance review, with answers grounded in source guidance."
  const whyNow =
    reviewData?.pitchArticulation.whyNow?.trim() ||
    "Finance teams need faster answers without giving up reviewability."
  const weeklyAssignment =
    reviewData?.weeklyAssignment?.trim() || "Refine the story around the work your finance team gets back."
  const scopeReasoning =
    reviewData?.scopeReasoning?.trim() ||
    "Keep the narrative anchored to operational relief, proof, and finance-safe trust."

  return {
    sourceLine: truncateFounderNote(sourceLine),
    problemBullets: reviewBullets.length > 0 ? reviewBullets : fallbackProblemBullets,
    hasCustomNotes: notes.trim().length > 0,
    thirtySecondVersion: truncateFounderNote(thirtySecondVersion, 220),
    howYouDiffer: truncateFounderNote(howYouDiffer, 180),
    whyNow: truncateFounderNote(whyNow, 180),
    weeklyAssignment: truncateFounderNote(weeklyAssignment, 180),
    scopeRecommendation: reviewData?.scopeRecommendation ?? null,
    scopeReasoning: truncateFounderNote(scopeReasoning, 220),
    lastUpdatedLabel: latestReview ? formatReviewDateLabel(latestReview.review_date) : null,
    hasDailyReview: Boolean(reviewData),
  }
}

function PitchEditorialPanel({
  notes,
  onChange,
}: {
  notes: string
  onChange: (value: string) => void
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [editorOpen, setEditorOpen] = useState(false)
  const [latestReview, setLatestReview] = useState<LatestCeoReview | null>(null)
  const [reviewStatus, setReviewStatus] = useState<"loading" | "loaded" | "empty" | "error">("loading")
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const source = buildPitchEditorialSource(notes, latestReview)

  const syncActiveSlide = useCallback(() => {
    const node = scrollerRef.current
    if (!node) return
    const nextIndex = Math.round(node.scrollLeft / Math.max(node.clientWidth, 1))
    setActiveIndex((current) => (current === nextIndex ? current : nextIndex))
  }, [])

  const goToSlide = useCallback((index: number) => {
    const node = scrollerRef.current
    if (!node) return
    const boundedIndex = Math.min(Math.max(index, 0), PITCH_EDITORIAL_PAGE_TITLES.length - 1)
    node.scrollTo({
      left: node.clientWidth * boundedIndex,
      behavior: "smooth",
    })
    setActiveIndex(boundedIndex)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadLatestReview() {
      try {
        const res = await fetch("/api/ceo-review")
        const json = (await res.json()) as { review?: LatestCeoReview | null; error?: string }
        if (!res.ok) throw new Error(json.error ?? "Failed to load daily CEO review")
        if (cancelled) return
        setLatestReview(json.review ?? null)
        setReviewStatus(json.review ? "loaded" : "empty")
      } catch (error) {
        if (cancelled) return
        console.error("[PitchEditorialPanel]", error)
        setLatestReview(null)
        setReviewStatus("error")
      }
    }

    void loadLatestReview()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    syncActiveSlide()
    window.addEventListener("resize", syncActiveSlide)
    return () => window.removeEventListener("resize", syncActiveSlide)
  }, [syncActiveSlide])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable

      if (isTypingTarget || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === "ArrowRight") {
        event.preventDefault()
        goToSlide(activeIndex + 1)
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        goToSlide(activeIndex - 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeIndex, goToSlide])

  const editorialSourceLabel = source.hasDailyReview
    ? `Daily Inngest refresh active. Latest CEO review: ${source.lastUpdatedLabel}.`
    : reviewStatus === "loading"
      ? "Loading the latest CEO review. Your saved notes stay untouched."
      : reviewStatus === "error"
        ? "Could not load the daily CEO review. Showing your saved notes."
        : "No daily CEO review yet. Showing your saved notes until Inngest writes one."

  return (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-[900px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-[13px] leading-relaxed text-muted-foreground">{TAB_HINT.pitchArticulation.hint}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
            Swipe sideways inside this panel. Arrow keys also move page to page.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{editorialSourceLabel}</p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-[12px]"
            onClick={() => setEditorOpen((open) => !open)}
          >
            {editorOpen ? "Hide source notes" : "Edit source notes"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => goToSlide(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous editorial page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => goToSlide(activeIndex + 1)}
            disabled={activeIndex === PITCH_EDITORIAL_PAGE_TITLES.length - 1}
            aria-label="Next editorial page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-border/60 bg-background shadow-[0_30px_120px_rgba(15,23,42,0.12)]">
        <div
          ref={scrollerRef}
          className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth"
          style={{ height: "min(72vh, 760px)", touchAction: "pan-x" }}
          onScroll={syncActiveSlide}
        >
          <section className="min-w-full snap-start overflow-hidden bg-[#071524] text-white">
            <div className="grid h-full md:grid-cols-[1.08fr_0.92fr]">
              <div className="flex h-full flex-col justify-between border-b border-white/10 bg-[radial-gradient(circle_at_18%_18%,rgba(79,142,247,0.28),transparent_26%),radial-gradient(circle_at_78%_20%,rgba(0,212,170,0.16),transparent_24%),linear-gradient(145deg,#071524,#060e1f_58%,#09162b)] p-5 md:border-b-0 md:border-r md:p-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/55">Cover</p>
                  <p className="mt-10 text-[11px] uppercase tracking-[0.32em] text-emerald-300/80">
                    Augentik / Finance / Compliance / AI
                  </p>
                  <h2
                    className={cn(
                      editorialSerif.className,
                      "mt-4 text-[clamp(3.8rem,9vw,8.4rem)] leading-[0.86] tracking-[-0.07em]",
                    )}
                  >
                    Augentik
                  </h2>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-white/76 md:text-xl">
                    Financial compliance on autopilot for accounting and finance teams.
                  </p>
                  <p className="mt-6 max-w-lg text-sm leading-relaxed text-white/58 md:text-base">
                    {source.sourceLine}
                  </p>
                </div>

                <div className="grid gap-3 text-sm text-white/74 md:grid-cols-2">
                  <div className="border-t border-white/12 pt-3">GAAP, SEC, and SOX guidance grounded in source text.</div>
                  <div className="border-t border-white/12 pt-3">Built for review-ready answers, not generic AI summaries.</div>
                </div>
              </div>

              <div className="flex h-full flex-col justify-between bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] p-5 md:p-8">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-white/68">
                    {source.hasDailyReview
                      ? `Inngest sync ${source.lastUpdatedLabel ?? "today"}`
                      : source.hasCustomNotes
                        ? "Live from your notes"
                        : "Seeded founder view"}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.26em] text-white/48">augentik.com</span>
                </div>

                <div className="space-y-3">
                  <p
                    className={cn(
                      editorialSerif.className,
                      "text-[clamp(5.8rem,14vw,10.5rem)] leading-none tracking-[-0.08em] text-white",
                    )}
                  >
                    99%
                  </p>
                  <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-white/58">
                    {source.scopeRecommendation
                      ? `Latest CEO scope call: ${source.scopeRecommendation}`
                      : "FinanceBenchmark score called out on the live site as a proof anchor."}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="border-t border-white/12 pt-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">Proof</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/76">Paragraph citations for audit-safe answers.</p>
                  </div>
                  <div className="border-t border-white/12 pt-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">Motion</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/76">No-signup demos reduce friction at launch.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-full snap-start overflow-hidden bg-[linear-gradient(90deg,#f6f0e7_0_41%,#dbe8f9_41%_100%)] text-slate-950">
            <div className="grid h-full md:grid-cols-[0.9fr_1.1fr]">
              <div className="flex h-full flex-col justify-between border-b border-slate-900/10 p-5 md:border-b-0 md:border-r md:p-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-500">Problem</p>
                  <h2
                    className={cn(
                      editorialSerif.className,
                      "mt-5 text-[clamp(3rem,7vw,6.5rem)] leading-[0.9] tracking-[-0.06em]",
                    )}
                  >
                    Audits cost more than the invoice.
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-700 md:text-lg">
                    The direct spend is obvious. The hidden tax is the distraction, delay, and stress absorbed by the
                    finance team long before scrutiny peaks.
                  </p>
                </div>

                <div className="space-y-3">
                  <p
                    className={cn(
                      editorialSerif.className,
                      "text-[clamp(5rem,12vw,9rem)] leading-none tracking-[-0.08em] text-slate-950",
                    )}
                  >
                    5
                  </p>
                  <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-slate-500">
                    Hidden costs show up before any external finding does.
                  </p>
                </div>
              </div>

              <div className="grid h-full grid-cols-2 grid-rows-2">
                {source.problemBullets.map((bullet, index) => (
                  <div
                    key={bullet}
                    className={cn(
                      "flex h-full flex-col justify-between border-slate-900/10 p-5 md:p-8",
                      index % 2 === 1 ? "border-l" : "",
                      index > 1 ? "border-t" : "",
                    )}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                      0{index + 1}
                    </p>
                    <p className="text-sm leading-relaxed text-slate-800 md:text-lg">{bullet}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="min-w-full snap-start overflow-hidden bg-[linear-gradient(90deg,#09162b_0_40%,#ebf4ff_40%_100%)] text-slate-950">
            <div className="grid h-full md:grid-cols-[0.86fr_1.14fr]">
              <div className="flex h-full flex-col justify-between border-b border-white/10 p-5 text-white md:border-b-0 md:border-r md:p-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/55">Solution</p>
                  <h2
                    className={cn(
                      editorialSerif.className,
                      "mt-5 text-[clamp(3rem,7vw,6.2rem)] leading-[0.9] tracking-[-0.06em]",
                    )}
                  >
                    Route the work through one operating layer.
                  </h2>
                </div>

                <div className="space-y-3">
                  <p
                    className={cn(
                      editorialSerif.className,
                      "text-[clamp(5rem,12vw,8.6rem)] leading-none tracking-[-0.08em] text-white",
                    )}
                  >
                    3
                  </p>
                  <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-white/55">
                    Intake, reasoning, and export instead of ad hoc coordination.
                  </p>
                </div>
              </div>

              <div className="flex h-full flex-col justify-between p-5 md:p-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">Operating steps</p>
                  <div className="mt-6 space-y-5">
                    {[
                      "Ask a finance or compliance question inside a domain-specific workspace.",
                      "Ground the answer in GAAP, SEC, and SOX guidance with paragraph-level traceability.",
                      "Turn that answer into material the team can review, document, and ship with confidence.",
                    ].map((step, index) => (
                      <div key={step} className="relative min-h-16 border-t border-slate-900/10 pt-5 pl-16">
                        <div className="absolute left-0 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#4f8ef7,#00d4aa)] font-mono text-xs uppercase tracking-[0.2em] text-white shadow-[0_14px_34px_rgba(79,142,247,0.28)]">
                          0{index + 1}
                        </div>
                        <p className="text-sm leading-relaxed text-slate-800 md:text-lg">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="max-w-lg border-t border-slate-900/10 pt-4 text-sm leading-relaxed text-slate-600">
                  {source.weeklyAssignment}
                </p>
              </div>
            </div>
          </section>
          <section className="min-w-full snap-start overflow-hidden bg-[linear-gradient(145deg,#edf4ff,#f8f1ea_54%,#ddfbf3)] text-slate-950">
            <div className="grid h-full grid-cols-1 md:grid-cols-[1.08fr_0.96fr_0.96fr] md:grid-rows-2">
              <div className="flex h-full flex-col justify-between border-b border-slate-900/10 p-5 md:row-span-2 md:border-b-0 md:border-r md:p-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-500">Features</p>
                  <h2
                    className={cn(
                      editorialSerif.className,
                      "mt-5 text-[clamp(3rem,7vw,6rem)] leading-[0.9] tracking-[-0.06em]",
                    )}
                  >
                    Built for the moments generic AI breaks.
                  </h2>
                </div>

                <div className="space-y-3">
                  <p
                    className={cn(
                      editorialSerif.className,
                      "text-[clamp(4.6rem,11vw,8rem)] leading-none tracking-[-0.08em]",
                    )}
                  >
                    24/7
                  </p>
                  <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-slate-500">
                    Decision support that stays available when the close clock keeps running.
                  </p>
                </div>
              </div>

              {[
                ["Paragraph citations", "Every answer can point back to the official source material reviewers care about."],
                ["FinanceBenchmark score", "A simple proof point on the live site makes performance feel concrete fast."],
                ["No-signup demos", "Prospects can touch the product before legal or procurement slows the conversation."],
                ["Review-ready outputs", "The goal is material that can move into accounting workflows, not chatbot novelty."],
              ].map(([title, copy], index) => (
                <div
                  key={title}
                  className={cn(
                    "flex h-full flex-col justify-between border-slate-900/10 p-5 md:p-8",
                    index % 2 === 0 ? "md:border-r" : "",
                    index > 1 ? "md:border-t" : "",
                    "border-b md:border-b-0",
                  )}
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">0{index + 1}</p>
                  <div>
                    <h3 className="text-lg font-semibold uppercase tracking-[0.06em] text-slate-900">{title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-700 md:text-base">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="min-w-full snap-start overflow-hidden bg-[linear-gradient(90deg,#d5e8ff_0_34%,#f6f3ee_34%_100%)] text-slate-950">
            <div className="grid h-full md:grid-cols-[0.82fr_1.18fr]">
              <div className="flex h-full flex-col justify-between border-b border-slate-900/10 p-5 md:border-b-0 md:border-r md:p-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-500">Audience</p>
                  <h2
                    className={cn(
                      editorialSerif.className,
                      "mt-5 text-[clamp(3rem,7vw,6rem)] leading-[0.9] tracking-[-0.06em]",
                    )}
                  >
                    The finance team, not the demo crowd.
                  </h2>
                </div>

                <div className="space-y-3">
                  <p
                    className={cn(
                      editorialSerif.className,
                      "text-[clamp(5rem,12vw,8.8rem)] leading-none tracking-[-0.08em]",
                    )}
                  >
                    4
                  </p>
                  <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-slate-500">
                    Core buying and influencing roles across the office of finance.
                  </p>
                </div>
              </div>

              <div className="grid h-full grid-cols-2 grid-rows-2">
                {[
                  ["Technical accounting", "Need confident answers with traceability when standards interpretation gets thorny."],
                  ["Controllers", "Need fewer interruptions to close, report, and prepare materials on time."],
                  ["CFO office", "Need leverage without growing a new coordination layer around every compliance question."],
                  ["Audit readiness leaders", "Need consistent evidence trails before outside scrutiny becomes urgent."],
                ].map(([title, copy], index) => (
                  <div
                    key={title}
                    className={cn(
                      "flex h-full flex-col justify-between border-slate-900/10 p-5 md:p-8",
                      index % 2 === 1 ? "border-l" : "",
                      index > 1 ? "border-t" : "",
                    )}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">0{index + 1}</p>
                    <div>
                      <h3 className="text-lg font-semibold uppercase tracking-[0.06em] text-slate-900">{title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-slate-700 md:text-base">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="min-w-full snap-start overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(79,142,247,0.16),transparent_24%),radial-gradient(circle_at_82%_78%,rgba(0,212,170,0.14),transparent_26%),linear-gradient(150deg,#0a1221,#08111d_52%,#071625)] text-white">
            <div className="grid h-full md:grid-cols-[0.82fr_1.18fr]">
              <div className="flex h-full flex-col justify-between border-b border-white/10 p-5 md:border-b-0 md:border-r md:p-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/55">Competition</p>
                  <h2
                    className={cn(
                      editorialSerif.className,
                      "mt-5 text-[clamp(3rem,7vw,6.1rem)] leading-[0.9] tracking-[-0.06em]",
                    )}
                  >
                    Not more tabs. One system for the work between them.
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 md:text-lg">
                    {source.howYouDiffer}
                  </p>
                </div>

                <div className="space-y-3">
                  <p
                    className={cn(
                      editorialSerif.className,
                      "text-[clamp(5rem,12vw,8.8rem)] leading-none tracking-[-0.08em]",
                    )}
                  >
                    1
                  </p>
                  <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-white/55">
                    One operating layer beats fragmented handoffs.
                  </p>
                </div>
              </div>

              <div className="grid h-full md:grid-cols-3">
                {[
                  [
                    "Manual research",
                    "Trusted, but slow. Every answer still requires standards lookup, screenshots, and internal routing.",
                  ],
                  [
                    "Generic AI",
                    "Fast, but risky. It sounds confident without giving finance teams the traceability they need.",
                  ],
                  [
                    "Augentik",
                    "Domain-specific models, official guidance grounding, and outputs designed for accounting review.",
                  ],
                ].map(([title, copy], index) => (
                  <div
                    key={title}
                    className={cn(
                      "flex h-full flex-col justify-between border-white/10 p-5 md:p-8",
                      index > 0 ? "md:border-l" : "",
                      "border-t md:border-t-0",
                    )}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">0{index + 1}</p>
                    <div>
                      <h3 className="text-lg font-semibold uppercase tracking-[0.06em] text-white">{title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-white/68 md:text-base">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="min-w-full snap-start overflow-hidden bg-[linear-gradient(135deg,#f4eee4,#e4efff_52%,#f3f8f5)] text-slate-950">
            <div className="grid h-full md:grid-cols-[0.92fr_1.08fr]">
              <div className="flex h-full flex-col justify-between border-b border-slate-900/10 p-5 md:border-b-0 md:border-r md:p-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-500">Origin Story</p>
                  <h2
                    className={cn(
                      editorialSerif.className,
                      "mt-5 text-[clamp(3rem,7vw,6rem)] leading-[0.9] tracking-[-0.06em]",
                    )}
                  >
                    Finance teams do not need prettier guesses.
                  </h2>
                </div>

                <div className="space-y-3">
                  <p
                    className={cn(
                      editorialSerif.className,
                      "text-[clamp(4.8rem,11vw,8.4rem)] leading-none tracking-[-0.08em]",
                    )}
                  >
                    2024
                  </p>
                  <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-slate-500">
                    Founding year listed on the live Augentik site.
                  </p>
                </div>
              </div>

              <div className="flex h-full flex-col justify-between p-5 md:p-8">
                <div className="space-y-5">
                  <p className="max-w-2xl text-base leading-relaxed text-slate-800 md:text-2xl">"{source.sourceLine}"</p>
                  <p className="max-w-2xl text-sm leading-relaxed text-slate-700 md:text-lg">
                    The founding logic is simple: when the consequence of being wrong is real, finance teams need an
                    answer that survives review. That means starting with the rules, keeping citations visible, and
                    reducing the coordination drag around every question.
                  </p>
                  <p className="max-w-2xl text-sm leading-relaxed text-slate-700 md:text-lg">
                    The product story works best when it stays operational: less scramble, fewer interruptions, more
                    audit-safe confidence.
                  </p>
                </div>

                <div className="grid gap-3 border-t border-slate-900/10 pt-4 md:grid-cols-2">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">Core belief</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">Precision beats polish in finance software.</p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">Narrative note</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      Position the product as operational infrastructure, not a novelty assistant.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-full snap-start overflow-hidden bg-[radial-gradient(circle_at_20%_18%,rgba(0,212,170,0.16),transparent_22%),radial-gradient(circle_at_82%_26%,rgba(79,142,247,0.22),transparent_24%),linear-gradient(150deg,#071220,#081827_52%,#0c2232)] text-white">
            <div className="grid h-full md:grid-cols-[0.96fr_1.04fr]">
              <div className="flex h-full flex-col justify-between border-b border-white/10 p-5 md:border-b-0 md:border-r md:p-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/55">Launch / Traction</p>
                  <h2
                    className={cn(
                      editorialSerif.className,
                      "mt-5 text-[clamp(3rem,7vw,6rem)] leading-[0.9] tracking-[-0.06em]",
                    )}
                  >
                    Early traction is framed around confidence, not hype.
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 md:text-lg">{source.whyNow}</p>
                </div>

                <div className="space-y-3">
                  <p
                    className={cn(
                      editorialSerif.className,
                      "text-[clamp(5.2rem,12vw,9rem)] leading-none tracking-[-0.08em]",
                    )}
                  >
                    99%
                  </p>
                  <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-white/55">
                    A large, memorable proof anchor gives the story weight immediately.
                  </p>
                </div>
              </div>

              <div className="grid h-full grid-cols-2 grid-rows-2">
                {[
                  ["No-signup demos", "Fast product access lowers friction for skeptical buyers and busy operators."],
                  ["Paragraph citations", "Specificity turns a demo answer into something a reviewer can trust."],
                  ["Focused category", "GAAP, SEC, and SOX language keeps positioning crisp and believable."],
                  ["Operational tone", "The best traction story is reduced workload, not abstract AI magic."],
                ].map(([title, copy], index) => (
                  <div
                    key={title}
                    className={cn(
                      "flex h-full flex-col justify-between border-white/10 p-5 md:p-8",
                      index % 2 === 1 ? "border-l" : "",
                      index > 1 ? "border-t" : "",
                    )}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">0{index + 1}</p>
                    <div>
                      <h3 className="text-lg font-semibold uppercase tracking-[0.06em] text-white">{title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-white/68 md:text-base">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="min-w-full snap-start overflow-hidden bg-[linear-gradient(140deg,#0a1221,#071522_54%,#0a1830)] text-white">
            <div className="grid h-full md:grid-cols-[0.88fr_1.12fr]">
              <div className="flex h-full flex-col justify-between border-b border-white/10 p-5 md:border-b-0 md:border-r md:p-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/55">Tech</p>
                  <h2
                    className={cn(
                      editorialSerif.className,
                      "mt-5 text-[clamp(3rem,7vw,6rem)] leading-[0.9] tracking-[-0.06em]",
                    )}
                  >
                    The stack is only persuasive when the output is reviewable.
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 md:text-lg">{source.scopeReasoning}</p>
                </div>

                <div className="space-y-3">
                  <p
                    className={cn(
                      editorialSerif.className,
                      "bg-[linear-gradient(135deg,#4f8ef7,#00d4aa)] bg-clip-text text-[clamp(5rem,12vw,8.8rem)] leading-none tracking-[-0.08em] text-transparent",
                    )}
                  >
                    3
                  </p>
                  <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-white/55">
                    Source corpus, cited reasoning, and output formats teams can act on.
                  </p>
                </div>
              </div>

              <div className="grid h-full grid-cols-2 grid-rows-2">
                {[
                  ["Domain grounding", "Answers are anchored in finance and compliance guidance rather than broad web synthesis."],
                  ["Citation layer", "Paragraph references keep every claim inspectable under scrutiny."],
                  ["Workflow output", "Responses are designed to move into finance operations, decks, and review artifacts."],
                  ["Trust architecture", "The product earns belief through traceability and specificity instead of theatrics."],
                ].map(([title, copy], index) => (
                  <div
                    key={title}
                    className={cn(
                      "flex h-full flex-col justify-between border-white/10 p-5 md:p-8",
                      index % 2 === 1 ? "border-l" : "",
                      index > 1 ? "border-t" : "",
                    )}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">0{index + 1}</p>
                    <div>
                      <h3 className="text-lg font-semibold uppercase tracking-[0.06em] text-white">{title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-white/68 md:text-base">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="min-w-full snap-start overflow-hidden bg-[radial-gradient(circle_at_22%_20%,rgba(79,142,247,0.26),transparent_24%),radial-gradient(circle_at_78%_72%,rgba(0,212,170,0.2),transparent_26%),linear-gradient(150deg,#06101c,#08111d_56%,#071524)] text-white">
            <div className="grid h-full md:grid-cols-[1.02fr_0.98fr]">
              <div className="flex h-full flex-col justify-between border-b border-white/10 p-5 md:border-b-0 md:border-r md:p-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/55">Back Cover</p>
                  <h2
                    className={cn(
                      editorialSerif.className,
                      "mt-5 text-[clamp(3.2rem,8vw,6.4rem)] leading-[0.9] tracking-[-0.06em]",
                    )}
                  >
                    Finance teams deserve answers that survive review.
                  </h2>
                  <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/72 md:text-lg">
                    {source.thirtySecondVersion}
                  </p>
                </div>

                <div className="space-y-3">
                  <p
                    className={cn(
                      editorialSerif.className,
                      "text-[clamp(4.8rem,11vw,8.4rem)] leading-none tracking-[-0.08em]",
                    )}
                  >
                    Now
                  </p>
                  <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-white/55">
                    Category language sharp enough for decks, demos, and investor conversations.
                  </p>
                </div>
              </div>

              <div className="flex h-full flex-col justify-between bg-white/5 p-5 md:p-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">URL</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">augentik.com</p>
                </div>

                <div className="space-y-4 border-y border-white/10 py-5">
                  <p className="text-sm leading-relaxed text-white/72 md:text-lg">Financial compliance on autopilot.</p>
                  <p className="text-sm leading-relaxed text-white/72 md:text-lg">
                    {source.sourceLine}
                  </p>
                </div>

                <div className="grid gap-3 text-sm text-white/72 md:grid-cols-2">
                  <div className="border-t border-white/12 pt-3">Use this view to pressure-test story flow before reworking raw notes.</div>
                  <div className="border-t border-white/12 pt-3">Edit the source below and the editorial layout updates in place.</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-border/60 bg-background/90 px-4 py-3">
          {PITCH_EDITORIAL_PAGE_TITLES.map((title, index) => (
            <button
              key={title}
              type="button"
              onClick={() => goToSlide(index)}
              className={cn(
                "h-2.5 rounded-full transition-all",
                activeIndex === index ? "w-8 bg-slate-950 dark:bg-white" : "w-2.5 bg-slate-300 dark:bg-white/28",
              )}
              aria-label={`Go to ${title}`}
              aria-pressed={activeIndex === index}
            />
          ))}
        </div>
      </div>

      {editorOpen && (
        <div className="mx-auto max-w-[900px] space-y-3 rounded-[1.5rem] border border-border bg-card/70 p-4 shadow-sm">
          <div className="space-y-1">
            <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Source notes</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              This stays editable and private to you. The editorial spread above now prefers the latest daily CEO review
              from Inngest, then falls back to these saved notes when no review is available.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-pitchArticulation" className="sr-only">
              {TAB_HINT.pitchArticulation.title}
            </Label>
            <Textarea
              id="fb-pitchArticulation"
              value={notes}
              onChange={(e) => onChange(e.target.value)}
              placeholder={TAB_HINT.pitchArticulation.placeholder}
              rows={12}
              className="min-h-[260px] resize-y text-[13px] leading-relaxed"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ CEO Review tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  const [orgId, setOrgId] = useState<string | null>(null)
  const [data, setData] = useState<FounderBrandState>(() => loadFounderBrandState(null))

  // Resolve org ID from the active session, then reload state scoped to that org.
  useEffect(() => {
    async function resolveOrg() {
      try {
        const res = await fetch("/api/company/profile")
        if (!res.ok) return
        const json = await res.json()
        const id: string | null =
          json?.organization?.id ?? json?.workspace?.id ?? null
        if (!id) return
        setOrgId(id)
        setData(loadFounderBrandState(id))
      } catch {
        // Non-fatal — fall back to unscoped state
      }
    }
    void resolveOrg()
  }, [])

  useEffect(() => {
    saveFounderBrandState(data, orgId)
  }, [data, orgId])

  function patch(key: BrandNotesTabKey, value: string) {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-[900px] flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <UserCircle className="h-5 w-5 text-muted-foreground" />
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Founder</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Founder brand</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Daily AI strategic review, plus your public presence workflow. Collaboration opportunities live in the public
          presence tab.
        </p>
      </div>

      <Tabs defaultValue="publicPresence" className="w-full">
        <div className="mx-auto max-w-[900px]">
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
        </div>

        <TabsContent value="strategicReview" className="mt-4 focus-visible:outline-none">
          <div className="mx-auto max-w-[900px]">
            <CeoReviewPanel />
          </div>
        </TabsContent>

        {BRAND_TAB_KEYS.map((key) => (
          <TabsContent key={key} value={key} className="mt-4 focus-visible:outline-none">
            {key === "publicPresence" ? (
              <div className="mx-auto max-w-[900px]">
                <FounderPublicPresencePanel
                  hint={TAB_HINT.publicPresence.hint}
                  placeholder={TAB_HINT.publicPresence.placeholder}
                  data={data}
                  setData={setData}
                />
              </div>
            ) : key === "pitchArticulation" ? (
              <PitchEditorialPanel notes={data.pitchArticulation} onChange={(value) => patch("pitchArticulation", value)} />
            ) : (
              <div className="mx-auto max-w-[900px] space-y-3">
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
              </div>
            )}
          </TabsContent>
        ))}

        <TabsContent value="designDocs" className="mt-4 focus-visible:outline-none">
          <div className="mx-auto max-w-[900px]">
            <DesignDocsPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

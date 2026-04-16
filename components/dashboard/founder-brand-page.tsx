"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Instrument_Serif } from "next/font/google"
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  RefreshCw,
  Sparkles,
  Check,
  X,
  AlertTriangle,
  Zap,
  Target,
  TrendingUp,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FounderPublicPresencePanel } from "@/components/dashboard/founder-public-presence-panel"
import {
  loadFounderBrandState,
  saveFounderBrandState,
  type FounderBrandState,
} from "@/lib/founder-brand"
import type { CeoReviewData } from "@/lib/inngest/functions/cbs-ceo-review"
import { cn } from "@/lib/utils"

const serif = Instrument_Serif({ subsets: ["latin"], weight: ["400"] })

// ─── Pitch deck data shape ────────────────────────────────────────

type SlideContent = {
  /** Shown in top-left corner mono label */
  label: string
  /** Large headline */
  headline: string
  /** Body paragraph */
  body: string
  /** Big stat / number */
  stat: string
  /** Caption under the stat */
  statCaption: string
  /** Up to 4 bullets / cards */
  bullets: string[]
}

type PitchDeck = {
  companyName: string
  tagline: string
  url: string
  cover: SlideContent
  problem: SlideContent
  solution: SlideContent
  features: SlideContent
  audience: SlideContent
  competition: SlideContent
  traction: SlideContent
  backCover: SlideContent
}

const SLIDE_KEYS = [
  "cover",
  "problem",
  "solution",
  "features",
  "audience",
  "competition",
  "traction",
  "backCover",
] as const

type SlideKey = (typeof SLIDE_KEYS)[number]

const SLIDE_LABELS: Record<SlideKey, string> = {
  cover: "Cover",
  problem: "Problem",
  solution: "Solution",
  features: "Features",
  audience: "Audience",
  competition: "Competition",
  traction: "Traction",
  backCover: "Back Cover",
}

const DECK_STORAGE_KEY = "juno.pitch-deck.v1"

function loadDeck(orgId: string | null): PitchDeck | null {
  if (typeof window === "undefined") return null
  try {
    const key = orgId ? `${DECK_STORAGE_KEY}:${orgId}` : DECK_STORAGE_KEY
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as PitchDeck
  } catch {
    return null
  }
}

function saveDeck(deck: PitchDeck, orgId: string | null) {
  if (typeof window === "undefined") return
  const key = orgId ? `${DECK_STORAGE_KEY}:${orgId}` : DECK_STORAGE_KEY
  window.localStorage.setItem(key, JSON.stringify(deck))
}

function emptyDeck(): PitchDeck {
  return {
    companyName: "Your Company",
    tagline: "One sentence that captures what you do.",
    url: "yourcompany.com",
    cover: {
      label: "Cover",
      headline: "Your Company",
      body: "One sentence that captures what you do.",
      stat: "—",
      statCaption: "Key proof point",
      bullets: [],
    },
    problem: {
      label: "Problem",
      headline: "The problem you solve.",
      body: "The direct cost is obvious. The hidden tax is what your customers absorb before they even find you.",
      stat: "—",
      statCaption: "Hidden costs show up early.",
      bullets: [
        "Pain point 1",
        "Pain point 2",
        "Pain point 3",
        "Pain point 4",
      ],
    },
    solution: {
      label: "Solution",
      headline: "How you fix it.",
      body: "Describe your solution clearly and concisely.",
      stat: "3",
      statCaption: "Simple steps from problem to result.",
      bullets: [
        "Step 1: How the user starts.",
        "Step 2: How your product works.",
        "Step 3: What the user walks away with.",
      ],
    },
    features: {
      label: "Features",
      headline: "Built for the moments everything else breaks.",
      body: "",
      stat: "24/7",
      statCaption: "Always available when it matters most.",
      bullets: [
        "Feature 1 — why it matters",
        "Feature 2 — why it matters",
        "Feature 3 — why it matters",
        "Feature 4 — why it matters",
      ],
    },
    audience: {
      label: "Audience",
      headline: "Who you serve.",
      body: "",
      stat: "—",
      statCaption: "Core buying and decision roles.",
      bullets: [
        "Persona 1 — what they need",
        "Persona 2 — what they need",
        "Persona 3 — what they need",
        "Persona 4 — what they need",
      ],
    },
    competition: {
      label: "Competition",
      headline: "Not another tool. A different system.",
      body: "How you differ from the obvious alternatives.",
      stat: "1",
      statCaption: "One operating layer beats fragmented handoffs.",
      bullets: [
        "Alternative 1 — its weakness",
        "Alternative 2 — its weakness",
        "Your product — your edge",
      ],
    },
    traction: {
      label: "Traction",
      headline: "Early proof, framed around results.",
      body: "What is already working and why it matters.",
      stat: "—",
      statCaption: "A memorable anchor gives the story weight.",
      bullets: [
        "Signal 1 — no-signup demos",
        "Signal 2 — specificity converts",
        "Signal 3 — focused category",
        "Signal 4 — operational tone",
      ],
    },
    backCover: {
      label: "Back Cover",
      headline: "Your customers deserve this.",
      body: "Close with the mission, not the feature list.",
      stat: "Now",
      statCaption: "Category language sharp enough for decks and demos.",
      bullets: [],
    },
  }
}

// ─── Slide editor overlay ─────────────────────────────────────────

function SlideEditor({
  slide,
  onSave,
  onCancel,
}: {
  slide: SlideContent
  onSave: (updated: SlideContent) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<SlideContent>(slide)

  function field(key: keyof SlideContent, label: string, multiline = false) {
    const value = key === "bullets" ? draft.bullets.join("\n") : (draft[key] as string)
    return (
      <div className="space-y-1">
        <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
        {multiline ? (
          <Textarea
            value={value}
            rows={key === "bullets" ? 5 : 3}
            className="text-[13px] leading-relaxed resize-y"
            onChange={(e) => {
              if (key === "bullets") {
                setDraft((d) => ({ ...d, bullets: e.target.value.split("\n") }))
              } else {
                setDraft((d) => ({ ...d, [key]: e.target.value }))
              }
            }}
          />
        ) : (
          <Input
            value={value}
            className="text-[13px]"
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          />
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-[13px] font-semibold text-foreground">Edit {slide.label} slide</p>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {field("headline", "Headline", true)}
          {field("body", "Body text", true)}
          {field("stat", "Big stat / number")}
          {field("statCaption", "Stat caption")}
          {slide.bullets.length > 0 || true
            ? field("bullets", "Bullets / cards (one per line)", true)
            : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(draft)}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Save slide
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Deck header editor ───────────────────────────────────────────

function DeckHeaderEditor({
  deck,
  onChange,
  onClose,
}: {
  deck: PitchDeck
  onChange: (updated: Partial<PitchDeck>) => void
  onClose: () => void
}) {
  const [name, setName] = useState(deck.companyName)
  const [tagline, setTagline] = useState(deck.tagline)
  const [url, setUrl] = useState(deck.url)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-[13px] font-semibold text-foreground">Edit deck header</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Company name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-[13px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tagline</Label>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} className="text-[13px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Website URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} className="text-[13px]" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { onChange({ companyName: name, tagline, url }); onClose() }}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Individual slides ────────────────────────────────────────────

function CoverSlide({ deck }: { deck: PitchDeck }) {
  const s = deck.cover
  return (
    <div className="grid h-full md:grid-cols-[1.08fr_0.92fr]">
      <div className="flex h-full flex-col justify-between border-b border-white/10 bg-[radial-gradient(circle_at_18%_18%,rgba(79,142,247,0.28),transparent_26%),linear-gradient(145deg,#071524,#060e1f_58%,#09162b)] p-5 md:border-b-0 md:border-r md:p-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/55">Cover</p>
          <p className="mt-10 text-[11px] uppercase tracking-[0.32em] text-emerald-300/80">
            {deck.companyName}
          </p>
          <h2 className={cn(serif.className, "mt-4 text-[clamp(3.8rem,9vw,8.4rem)] leading-[0.86] tracking-[-0.07em]")}>
            {deck.companyName}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/76 md:text-xl">
            {deck.tagline}
          </p>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-white/58 md:text-base">
            {s.body}
          </p>
        </div>
        <div className="grid gap-3 text-sm text-white/74 md:grid-cols-2">
          {(s.bullets.slice(0, 2)).map((b) => (
            <div key={b} className="border-t border-white/12 pt-3">{b}</div>
          ))}
        </div>
      </div>
      <div className="flex h-full flex-col justify-between bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] p-5 md:p-8">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-white/68">
            Live
          </span>
          <span className="text-[11px] uppercase tracking-[0.26em] text-white/48">{deck.url}</span>
        </div>
        <div className="space-y-3">
          <p className={cn(serif.className, "text-[clamp(5.8rem,14vw,10.5rem)] leading-none tracking-[-0.08em] text-white")}>
            {s.stat}
          </p>
          <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-white/58">{s.statCaption}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(s.bullets.slice(2, 4)).map((b, i) => (
            <div key={i} className="border-t border-white/12 pt-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">0{i + 1}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/76">{b}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProblemSlide({ deck }: { deck: PitchDeck }) {
  const s = deck.problem
  const bullets = [...s.bullets]
  while (bullets.length < 4) bullets.push("")
  return (
    <div className="grid h-full md:grid-cols-[0.9fr_1.1fr]">
      <div className="flex h-full flex-col justify-between border-b border-slate-900/10 p-5 md:border-b-0 md:border-r md:p-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-500">Problem</p>
          <h2 className={cn(serif.className, "mt-5 text-[clamp(3rem,7vw,6.5rem)] leading-[0.9] tracking-[-0.06em]")}>
            {s.headline}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-700 md:text-lg">{s.body}</p>
        </div>
        <div className="space-y-3">
          <p className={cn(serif.className, "text-[clamp(5rem,12vw,9rem)] leading-none tracking-[-0.08em] text-slate-950")}>
            {s.stat}
          </p>
          <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-slate-500">{s.statCaption}</p>
        </div>
      </div>
      <div className="grid h-full grid-cols-2 grid-rows-2">
        {bullets.slice(0, 4).map((bullet, index) => (
          <div key={index} className={cn("flex h-full flex-col justify-between border-slate-900/10 p-5 md:p-8", index % 2 === 1 ? "border-l" : "", index > 1 ? "border-t" : "")}>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">0{index + 1}</p>
            <p className="text-sm leading-relaxed text-slate-800 md:text-lg">{bullet}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SolutionSlide({ deck }: { deck: PitchDeck }) {
  const s = deck.solution
  const steps = [...s.bullets]
  while (steps.length < 3) steps.push("")
  return (
    <div className="grid h-full md:grid-cols-[0.86fr_1.14fr]">
      <div className="flex h-full flex-col justify-between border-b border-white/10 p-5 text-white md:border-b-0 md:border-r md:p-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/55">Solution</p>
          <h2 className={cn(serif.className, "mt-5 text-[clamp(3rem,7vw,6.2rem)] leading-[0.9] tracking-[-0.06em]")}>
            {s.headline}
          </h2>
        </div>
        <div className="space-y-3">
          <p className={cn(serif.className, "text-[clamp(5rem,12vw,8.6rem)] leading-none tracking-[-0.08em] text-white")}>
            {s.stat}
          </p>
          <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-white/55">{s.statCaption}</p>
        </div>
      </div>
      <div className="flex h-full flex-col justify-between p-5 md:p-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">Operating steps</p>
          <div className="mt-6 space-y-5">
            {steps.slice(0, 3).map((step, index) => (
              <div key={index} className="relative min-h-16 border-t border-slate-900/10 pt-5 pl-16">
                <div className="absolute left-0 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#4f8ef7,#00d4aa)] font-mono text-xs uppercase tracking-[0.2em] text-white shadow-[0_14px_34px_rgba(79,142,247,0.28)]">
                  0{index + 1}
                </div>
                <p className="text-sm leading-relaxed text-slate-800 md:text-lg">{step}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="max-w-lg border-t border-slate-900/10 pt-4 text-sm leading-relaxed text-slate-600">{s.body}</p>
      </div>
    </div>
  )
}

function FeaturesSlide({ deck }: { deck: PitchDeck }) {
  const s = deck.features
  const feats = [...s.bullets]
  while (feats.length < 4) feats.push("")
  const parsed = feats.slice(0, 4).map((b) => {
    const [title, ...rest] = b.split("—")
    return { title: title?.trim() ?? b, copy: rest.join("—").trim() }
  })
  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[1.08fr_0.96fr_0.96fr] md:grid-rows-2">
      <div className="flex h-full flex-col justify-between border-b border-slate-900/10 p-5 md:row-span-2 md:border-b-0 md:border-r md:p-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-500">Features</p>
          <h2 className={cn(serif.className, "mt-5 text-[clamp(3rem,7vw,6rem)] leading-[0.9] tracking-[-0.06em]")}>
            {s.headline}
          </h2>
        </div>
        <div className="space-y-3">
          <p className={cn(serif.className, "text-[clamp(4.6rem,11vw,8rem)] leading-none tracking-[-0.08em]")}>
            {s.stat}
          </p>
          <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-slate-500">{s.statCaption}</p>
        </div>
      </div>
      {parsed.map(({ title, copy }, index) => (
        <div key={index} className={cn("flex h-full flex-col justify-between border-slate-900/10 p-5 md:p-8", index % 2 === 0 ? "md:border-r" : "", index > 1 ? "md:border-t" : "", "border-b md:border-b-0")}>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">0{index + 1}</p>
          <div>
            <h3 className="text-lg font-semibold uppercase tracking-[0.06em] text-slate-900">{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 md:text-base">{copy}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function AudienceSlide({ deck }: { deck: PitchDeck }) {
  const s = deck.audience
  const personas = [...s.bullets]
  while (personas.length < 4) personas.push("")
  const parsed = personas.slice(0, 4).map((b) => {
    const [title, ...rest] = b.split("—")
    return { title: title?.trim() ?? b, copy: rest.join("—").trim() }
  })
  return (
    <div className="grid h-full md:grid-cols-[0.82fr_1.18fr]">
      <div className="flex h-full flex-col justify-between border-b border-slate-900/10 p-5 md:border-b-0 md:border-r md:p-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-500">Audience</p>
          <h2 className={cn(serif.className, "mt-5 text-[clamp(3rem,7vw,6rem)] leading-[0.9] tracking-[-0.06em]")}>
            {s.headline}
          </h2>
        </div>
        <div className="space-y-3">
          <p className={cn(serif.className, "text-[clamp(5rem,12vw,8.8rem)] leading-none tracking-[-0.08em]")}>
            {s.stat}
          </p>
          <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-slate-500">{s.statCaption}</p>
        </div>
      </div>
      <div className="grid h-full grid-cols-2 grid-rows-2">
        {parsed.map(({ title, copy }, index) => (
          <div key={index} className={cn("flex h-full flex-col justify-between border-slate-900/10 p-5 md:p-8", index % 2 === 1 ? "border-l" : "", index > 1 ? "border-t" : "")}>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">0{index + 1}</p>
            <div>
              <h3 className="text-lg font-semibold uppercase tracking-[0.06em] text-slate-900">{title}</h3>
              {copy && <p className="mt-3 text-sm leading-relaxed text-slate-700 md:text-base">{copy}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompetitionSlide({ deck }: { deck: PitchDeck }) {
  const s = deck.competition
  const alts = [...s.bullets]
  while (alts.length < 3) alts.push("")
  const parsed = alts.slice(0, 3).map((b) => {
    const [title, ...rest] = b.split("—")
    return { title: title?.trim() ?? b, copy: rest.join("—").trim() }
  })
  return (
    <div className="grid h-full md:grid-cols-[0.82fr_1.18fr]">
      <div className="flex h-full flex-col justify-between border-b border-white/10 p-5 text-white md:border-b-0 md:border-r md:p-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/55">Competition</p>
          <h2 className={cn(serif.className, "mt-5 text-[clamp(3rem,7vw,6.1rem)] leading-[0.9] tracking-[-0.06em]")}>
            {s.headline}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 md:text-lg">{s.body}</p>
        </div>
        <div className="space-y-3">
          <p className={cn(serif.className, "text-[clamp(5rem,12vw,8.8rem)] leading-none tracking-[-0.08em]")}>
            {s.stat}
          </p>
          <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-white/55">{s.statCaption}</p>
        </div>
      </div>
      <div className="grid h-full md:grid-cols-3">
        {parsed.map(({ title, copy }, index) => (
          <div key={index} className={cn("flex h-full flex-col justify-between border-white/10 p-5 md:p-8", index > 0 ? "md:border-l" : "", "border-t md:border-t-0")}>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">0{index + 1}</p>
            <div>
              <h3 className="text-lg font-semibold uppercase tracking-[0.06em] text-white">{title}</h3>
              {copy && <p className="mt-3 text-sm leading-relaxed text-white/68 md:text-base">{copy}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TractionSlide({ deck }: { deck: PitchDeck }) {
  const s = deck.traction
  const signals = [...s.bullets]
  while (signals.length < 4) signals.push("")
  const parsed = signals.slice(0, 4).map((b) => {
    const [title, ...rest] = b.split("—")
    return { title: title?.trim() ?? b, copy: rest.join("—").trim() }
  })
  return (
    <div className="grid h-full md:grid-cols-[0.96fr_1.04fr]">
      <div className="flex h-full flex-col justify-between border-b border-white/10 p-5 text-white md:border-b-0 md:border-r md:p-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/55">Traction</p>
          <h2 className={cn(serif.className, "mt-5 text-[clamp(3rem,7vw,6rem)] leading-[0.9] tracking-[-0.06em]")}>
            {s.headline}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 md:text-lg">{s.body}</p>
        </div>
        <div className="space-y-3">
          <p className={cn(serif.className, "text-[clamp(5.2rem,12vw,9rem)] leading-none tracking-[-0.08em]")}>
            {s.stat}
          </p>
          <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-white/55">{s.statCaption}</p>
        </div>
      </div>
      <div className="grid h-full grid-cols-2 grid-rows-2">
        {parsed.map(({ title, copy }, index) => (
          <div key={index} className={cn("flex h-full flex-col justify-between border-white/10 p-5 md:p-8", index % 2 === 1 ? "border-l" : "", index > 1 ? "border-t" : "")}>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">0{index + 1}</p>
            <div>
              <h3 className="text-lg font-semibold uppercase tracking-[0.06em] text-white">{title}</h3>
              {copy && <p className="mt-3 text-sm leading-relaxed text-white/68 md:text-base">{copy}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BackCoverSlide({ deck }: { deck: PitchDeck }) {
  const s = deck.backCover
  return (
    <div className="grid h-full md:grid-cols-[1.02fr_0.98fr]">
      <div className="flex h-full flex-col justify-between border-b border-white/10 p-5 text-white md:border-b-0 md:border-r md:p-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/55">Back Cover</p>
          <h2 className={cn(serif.className, "mt-5 text-[clamp(3.2rem,8vw,6.4rem)] leading-[0.9] tracking-[-0.06em]")}>
            {s.headline}
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/72 md:text-lg">{s.body}</p>
        </div>
        <div className="space-y-3">
          <p className={cn(serif.className, "text-[clamp(4.8rem,11vw,8.4rem)] leading-none tracking-[-0.08em]")}>
            {s.stat}
          </p>
          <p className="max-w-xs text-[11px] uppercase tracking-[0.26em] text-white/55">{s.statCaption}</p>
        </div>
      </div>
      <div className="flex h-full flex-col justify-between bg-white/5 p-5 md:p-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">Website</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">{deck.url}</p>
        </div>
        <div className="space-y-4 border-y border-white/10 py-5">
          <p className="text-sm leading-relaxed text-white/72 md:text-lg">{deck.tagline}</p>
        </div>
        <div className="grid gap-3 text-sm text-white/72 md:grid-cols-2">
          <div className="border-t border-white/12 pt-3">Use this view to pressure-test story flow.</div>
          <div className="border-t border-white/12 pt-3">Edit each slide using the pencil icon above.</div>
        </div>
      </div>
    </div>
  )
}

const SLIDE_BG: Record<SlideKey, string> = {
  cover: "bg-[#071524]",
  problem: "bg-[linear-gradient(90deg,#f6f0e7_0_41%,#dbe8f9_41%_100%)] text-slate-950",
  solution: "bg-[linear-gradient(90deg,#09162b_0_40%,#ebf4ff_40%_100%)] text-slate-950",
  features: "bg-[linear-gradient(145deg,#edf4ff,#f8f1ea_54%,#ddfbf3)] text-slate-950",
  audience: "bg-[linear-gradient(90deg,#d5e8ff_0_34%,#f6f3ee_34%_100%)] text-slate-950",
  competition: "bg-[radial-gradient(circle_at_18%_18%,rgba(79,142,247,0.16),transparent_24%),linear-gradient(150deg,#0a1221,#08111d_52%,#071625)] text-white",
  traction: "bg-[radial-gradient(circle_at_20%_18%,rgba(0,212,170,0.16),transparent_22%),linear-gradient(150deg,#071220,#081827_52%,#0c2232)] text-white",
  backCover: "bg-[radial-gradient(circle_at_22%_20%,rgba(79,142,247,0.26),transparent_24%),linear-gradient(150deg,#06101c,#08111d_56%,#071524)] text-white",
}

function renderSlide(key: SlideKey, deck: PitchDeck) {
  switch (key) {
    case "cover": return <CoverSlide deck={deck} />
    case "problem": return <ProblemSlide deck={deck} />
    case "solution": return <SolutionSlide deck={deck} />
    case "features": return <FeaturesSlide deck={deck} />
    case "audience": return <AudienceSlide deck={deck} />
    case "competition": return <CompetitionSlide deck={deck} />
    case "traction": return <TractionSlide deck={deck} />
    case "backCover": return <BackCoverSlide deck={deck} />
  }
}

// ─── Pitch deck carousel ──────────────────────────────────────────

function PitchDeckCarousel({
  deck,
  onUpdateSlide,
  onUpdateHeader,
  onGenerateFromContext,
  generating,
}: {
  deck: PitchDeck
  onUpdateSlide: (key: SlideKey, updated: SlideContent) => void
  onUpdateHeader: (updated: Partial<PitchDeck>) => void
  onGenerateFromContext: () => void
  generating: boolean
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [editingSlide, setEditingSlide] = useState<SlideKey | null>(null)
  const [editingHeader, setEditingHeader] = useState(false)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const activeKey = SLIDE_KEYS[activeIndex]

  const syncSlide = useCallback(() => {
    const node = scrollerRef.current
    if (!node) return
    const next = Math.round(node.scrollLeft / Math.max(node.clientWidth, 1))
    setActiveIndex((cur) => (cur === next ? cur : next))
  }, [])

  const goTo = useCallback((index: number) => {
    const node = scrollerRef.current
    if (!node) return
    const bounded = Math.min(Math.max(index, 0), SLIDE_KEYS.length - 1)
    node.scrollTo({ left: node.clientWidth * bounded, behavior: "smooth" })
    setActiveIndex(bounded)
  }, [])

  useEffect(() => {
    syncSlide()
    window.addEventListener("resize", syncSlide)
    return () => window.removeEventListener("resize", syncSlide)
  }, [syncSlide])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(activeIndex + 1) }
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(activeIndex - 1) }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [activeIndex, goTo])

  return (
    <>
      {editingSlide && (
        <SlideEditor
          slide={deck[editingSlide]}
          onSave={(updated) => { onUpdateSlide(editingSlide, updated); setEditingSlide(null) }}
          onCancel={() => setEditingSlide(null)}
        />
      )}
      {editingHeader && (
        <DeckHeaderEditor
          deck={deck}
          onChange={onUpdateHeader}
          onClose={() => setEditingHeader(false)}
        />
      )}

      {/* Controls bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] text-muted-foreground">
            Slide {activeIndex + 1} of {SLIDE_KEYS.length} · {SLIDE_LABELS[activeKey]}
            <span className="ml-2 text-muted-foreground/60">· Arrow keys navigate</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[12px]"
            onClick={() => setEditingHeader(true)}
          >
            <Edit3 className="mr-1.5 h-3.5 w-3.5" />
            Header
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[12px]"
            onClick={() => setEditingSlide(activeKey)}
          >
            <Edit3 className="mr-1.5 h-3.5 w-3.5" />
            Edit slide
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[12px]"
            onClick={onGenerateFromContext}
            disabled={generating}
          >
            {generating ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {generating ? "Generating…" : "Generate from context"}
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goTo(activeIndex + 1)} disabled={activeIndex === SLIDE_KEYS.length - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Slide viewport */}
      <div className="overflow-hidden rounded-[2rem] border border-border/60 bg-background shadow-[0_30px_120px_rgba(15,23,42,0.12)]">
        <div
          ref={scrollerRef}
          className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth"
          style={{ height: "min(72vh, 760px)", touchAction: "pan-x" }}
          onScroll={syncSlide}
        >
          {SLIDE_KEYS.map((key) => (
            <section key={key} className={cn("min-w-full snap-start overflow-hidden", SLIDE_BG[key])}>
              {renderSlide(key, deck)}
            </section>
          ))}
        </div>

        {/* Dot nav */}
        <div className="flex items-center justify-center gap-2 border-t border-border/60 bg-background/90 px-4 py-3">
          {SLIDE_KEYS.map((key, index) => (
            <button
              key={key}
              type="button"
              onClick={() => goTo(index)}
              className={cn("h-2.5 rounded-full transition-all", activeIndex === index ? "w-8 bg-slate-950 dark:bg-white" : "w-2.5 bg-slate-300 dark:bg-white/28")}
              aria-label={`Go to ${SLIDE_LABELS[key]}`}
              aria-pressed={activeIndex === index}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// ─── CEO Review panel ─────────────────────────────────────────────

const INSIGHT_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  "10_star_product": { label: "10-Star Product", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", icon: <Zap className="h-3 w-3" /> },
  wrong_problem: { label: "Wrong Problem?", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: <AlertTriangle className="h-3 w-3" /> },
  icp_drift: { label: "ICP Drift", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: <Target className="h-3 w-3" /> },
  timing_window: { label: "Timing Window", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: <Clock className="h-3 w-3" /> },
  leverage_point: { label: "Leverage Point", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: <TrendingUp className="h-3 w-3" /> },
}

type ReviewState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "triggering" }
  | { status: "loaded"; review: { review_date: string; review_data: CeoReviewData } }
  | { status: "error"; message: string }

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

  useEffect(() => { void load() }, [load])

  async function triggerReview() {
    setState({ status: "triggering" })
    try {
      const res = await fetch("/api/ceo-review", { method: "POST" })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to trigger")
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
          <Skeleton className="h-28" /><Skeleton className="h-28" />
          <Skeleton className="h-28" /><Skeleton className="h-28" />
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
          <p className="mt-1 text-sm text-muted-foreground">Runs automatically at 6am daily. Or trigger one now.</p>
        </div>
        <Button variant="outline" size="sm" disabled={state.status === "triggering"} onClick={() => void triggerReview()}>
          {state.status === "triggering" ? <><RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />Triggering…</> : "Generate review now →"}
        </Button>
        {state.status === "triggering" && <p className="text-xs text-muted-foreground">Running in the background — takes about 30 seconds. Refresh shortly.</p>}
      </div>
    )
  }

  if (state.status === "error") {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{state.message}</div>
  }

  const { review_date, review_data: r } = state.review
  const formattedDate = new Date(review_date + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
  const scopeColors: Record<string, string> = {
    EXPAND: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    HOLD: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    REDUCE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Strategic Review · {formattedDate}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Updates daily at 6am</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-900/10">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">This week's assignment</p>
        <p className="text-sm font-medium text-foreground">{r.weeklyAssignment}</p>
      </div>

      <div>
        <h3 className="mb-3 text-[13px] font-semibold text-foreground">Pitch articulation</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { label: "30-second version", value: r.pitchArticulation.thirtySecondVersion },
            { label: "One sentence", value: r.pitchArticulation.oneSentence },
            { label: "How you differ", value: r.pitchArticulation.howYouDiffer },
            { label: "Why now", value: r.pitchArticulation.whyNow },
          ].map(({ label, value }) => (
            <Card key={label} className="border-border bg-muted/30">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-[13px] leading-relaxed text-foreground">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {r.strategicInsights.length > 0 && (
        <div>
          <h3 className="mb-3 text-[13px] font-semibold text-foreground">Strategic insights</h3>
          <div className="space-y-3">
            {r.strategicInsights.map((insight, i) => {
              const cfg = INSIGHT_TYPE_CONFIG[insight.type] ?? { label: insight.type, color: "bg-gray-100 text-gray-700", icon: null }
              return (
                <Card key={i} className="border-border">
                  <CardContent className="pt-4 pb-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                    </div>
                    <p className="mb-1.5 text-[13px] font-medium leading-relaxed text-foreground">{insight.insight}</p>
                    <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">{insight.evidence}</p>
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

      {r.criticalGaps.length > 0 && (
        <div>
          <h3 className="mb-3 text-[13px] font-semibold text-foreground">Critical gaps</h3>
          <div className="space-y-2">
            {r.criticalGaps.map((gap, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive/70" />
                <p className="text-[13px] text-foreground">{gap}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scope recommendation</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${scopeColors[r.scopeRecommendation] ?? "bg-gray-100 text-gray-700"}`}>
              {r.scopeRecommendation}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-foreground">{r.scopeReasoning}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export function FounderBrandPageContent() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [founderState, setFounderState] = useState<FounderBrandState>(() => loadFounderBrandState(null))
  const [deck, setDeck] = useState<PitchDeck>(() => emptyDeck())
  const [deckLoaded, setDeckLoaded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Resolve org and load deck from localStorage
  useEffect(() => {
    async function resolveOrg() {
      try {
        const res = await fetch("/api/company/profile")
        if (!res.ok) return
        const json = await res.json()
        const id: string | null = json?.organization?.id ?? json?.workspace?.id ?? null
        setOrgId(id)
        setFounderState(loadFounderBrandState(id))
        const saved = loadDeck(id)
        if (saved) {
          setDeck(saved)
        }
      } catch {
        // fall back to unscoped
      } finally {
        setDeckLoaded(true)
      }
    }
    void resolveOrg()
  }, [])

  useEffect(() => {
    saveFounderBrandState(founderState, orgId)
  }, [founderState, orgId])

  useEffect(() => {
    if (deckLoaded) saveDeck(deck, orgId)
  }, [deck, orgId, deckLoaded])

  function updateSlide(key: SlideKey, updated: SlideContent) {
    setDeck((d) => ({ ...d, [key]: updated }))
  }

  function updateHeader(updated: Partial<PitchDeck>) {
    setDeck((d) => ({ ...d, ...updated }))
  }

  async function generateFromContext() {
    setGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch("/api/founder-brand/generate-deck", { method: "POST" })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? "Failed to generate")
      }
      const json = (await res.json()) as { deck?: PitchDeck; error?: string }
      if (json.deck) {
        setDeck(json.deck)
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Founder brand</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pitch deck</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Your investor and customer pitch in editorial format. Edit each slide directly, or generate all slides from your saved company context.
        </p>
      </div>

      {generateError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {generateError}
        </div>
      )}

      {/* Pitch deck */}
      <div className="space-y-4">
        {deckLoaded ? (
          <PitchDeckCarousel
            deck={deck}
            onUpdateSlide={updateSlide}
            onUpdateHeader={updateHeader}
            onGenerateFromContext={generateFromContext}
            generating={generating}
          />
        ) : (
          <Skeleton className="h-[min(72vh,760px)] w-full rounded-[2rem]" />
        )}
      </div>

      {/* Secondary tabs */}
      <div className="border-t border-border pt-8">
        <Tabs defaultValue="strategicReview">
          <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-border bg-muted/40 p-1">
            <TabsTrigger value="strategicReview" className="rounded-md px-3 py-2 text-[12px] data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Strategic Review
            </TabsTrigger>
            <TabsTrigger value="publicPresence" className="rounded-md px-3 py-2 text-[12px] data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Public Presence
            </TabsTrigger>
            <TabsTrigger value="brandNotes" className="rounded-md px-3 py-2 text-[12px] data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Brand Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="strategicReview" className="focus-visible:outline-none">
            <div className="max-w-[900px]">
              <CeoReviewPanel />
            </div>
          </TabsContent>

          <TabsContent value="publicPresence" className="focus-visible:outline-none">
            <div className="max-w-[900px]">
              <FounderPublicPresencePanel
                hint="Intelligence feed, your scheduled topics, then other channels: LinkedIn, talks, newsletter, podcast."
                placeholder="Primary channels and rough cadence…"
                data={founderState}
                setData={setFounderState}
              />
            </div>
          </TabsContent>

          <TabsContent value="brandNotes" className="focus-visible:outline-none">
            <div className="max-w-[900px] space-y-6">
              {(["pitchArticulation", "brandStrategies", "credibilityProof"] as const).map((key) => {
                const labels: Record<string, string> = {
                  pitchArticulation: "Pitch notes",
                  brandStrategies: "Brand strategy",
                  credibilityProof: "Credibility & proof",
                }
                const hints: Record<string, string> = {
                  pitchArticulation: "Your raw pitch notes — elevator pitch, one-liners, investor and customer versions.",
                  brandStrategies: "How you will build and reinforce your founder brand over time.",
                  credibilityProof: "Why people should listen — background, wins, logos, metrics, third-party validation.",
                }
                const placeholders: Record<string, string> = {
                  pitchArticulation: "30-second version…\n\nOne sentence you want repeated…\n\nHow you differ…",
                  brandStrategies: "North-star theme for the next 6–12 months…\n\nContent pillars…",
                  credibilityProof: "2–3 proof points you want front and center…\n\nBio line for profiles and decks…",
                }
                return (
                  <div key={key} className="space-y-2">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{labels[key]}</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">{hints[key]}</p>
                    </div>
                    <Textarea
                      value={founderState[key] ?? ""}
                      onChange={(e) => setFounderState((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholders[key]}
                      rows={6}
                      className="resize-y text-[13px] leading-relaxed"
                    />
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

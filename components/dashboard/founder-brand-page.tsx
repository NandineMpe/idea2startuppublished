"use client"

import { useEffect, useState } from "react"
import { UserCircle } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { FounderPublicPresencePanel } from "@/components/dashboard/founder-public-presence-panel"
import {
  loadFounderBrandState,
  saveFounderBrandState,
  type FounderBrandState,
} from "@/lib/founder-brand"

const BRAND_TAB_KEYS = [
  "pitchArticulation",
  "brandStrategies",
  "publicPresence",
  "credibilityProof",
  "founderLocation",
] as const

type FounderBrandTabKey = (typeof BRAND_TAB_KEYS)[number]

const TAB_HINT: Record<
  FounderBrandTabKey,
  { title: string; hint: string; placeholder: string }
> = {
  pitchArticulation: {
    title: "Pitch Articulation",
    hint: "Elevator pitch, one-liners, and how you explain the problem and your edge — investor, customer, and peer versions if useful.",
    placeholder:
      "30-second version…\n\nOne sentence you want repeated…\n\nHow you differ from the obvious alternative…",
  },
  brandStrategies: {
    title: "Brand Strategies",
    hint: "How you will build and reinforce your founder brand over time — themes, campaigns, partnerships, and what you will not do.",
    placeholder:
      "North-star theme for the next 6–12 months…\n\nContent pillars or narratives…\n\nRisks to avoid (tone, topics, over-promising)…",
  },
  publicPresence: {
    title: "Public presence",
    hint: "TikTok digest, your scheduled topics (with links & media), then other channels — LinkedIn, talks, newsletter, podcast.",
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

export function FounderBrandPageContent() {
  const [data, setData] = useState<FounderBrandState>(() => loadFounderBrandState())

  useEffect(() => {
    saveFounderBrandState(data)
  }, [data])

  function patch(key: FounderBrandTabKey, value: string) {
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
          Pitch, strategy, presence, proof, and where you operate — aligned with company branding and your ICP.
        </p>
      </div>

      <Tabs defaultValue="pitchArticulation" className="w-full">
        <TabsList className="mb-1 flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {BRAND_TAB_KEYS.map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              className="rounded-md px-3 py-2 text-[12px] data-[state=active]:bg-background data-[state=active]:shadow-sm sm:text-[13px]"
            >
              {TAB_HINT[key].title}
            </TabsTrigger>
          ))}
        </TabsList>

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
      </Tabs>
    </div>
  )
}

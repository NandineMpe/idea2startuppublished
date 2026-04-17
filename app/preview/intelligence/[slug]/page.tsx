"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  Loader2,
  Lock,
  Zap,
  Bot,
  FileText,
  Target,
  Banknote,
  Radio,
  Shield,
  Users,
  ExternalLink,
  Flame,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

type BriefItem = {
  title?: string
  headline?: string
  url?: string
  source?: string
  relevance?: string
  summary?: string
  score?: number
  whyItMatters?: string
  strategicImplication?: string
  suggestedAction?: string
  connectionToRoadmap?: string | null
  urgency?: string
  category?: string
}

type BriefDashboard = {
  breaking?: BriefItem[]
  ai_tools?: BriefItem[]
  research?: BriefItem[]
  competitors?: BriefItem[]
  funding?: BriefItem[]
}

type BriefContent = {
  markdown?: string
  dashboard?: BriefDashboard
}

type BriefRow = {
  id: string
  content: BriefContent
  created_at: string
}

type BehavioralTheme = { title: string; detail: string }
type BehavioralSummary = {
  overview: string
  sentiment: string
  themes: BehavioralTheme[]
  painPoints: string[]
  frictionPoints: string[]
  currentSolutions: string[]
  nextMoves: string[]
}

type BehavioralSnapshot = {
  id: string
  created_at: string
  summary: BehavioralSummary
  conversationCount: number
  subreddits: string[]
  latestSignalAt: string | null
}

type PreviewPayload = {
  label: string
  companyName: string | null
  updatedAt: string | null
  features: {
    signalFeed: boolean
    securityAlerts: boolean
    behavioral: boolean
    intentSignals: boolean
  }
  brief: BriefRow | null
  behavioralUpdates: BehavioralSnapshot | null
  hotIntentCount: number
  securityCounts: {
    critical: number
    high: number
    medium: number
    low: number
    total: number
  } | null
}

const SIGNAL_SECTIONS: {
  key: keyof BriefDashboard
  label: string
  icon: typeof Zap
  description: string
}[] = [
  { key: "breaking", label: "Breaking", icon: Zap, description: "Time-sensitive news that may affect your market." },
  { key: "ai_tools", label: "AI & tools", icon: Bot, description: "Model and product releases in your space." },
  { key: "research", label: "Research", icon: FileText, description: "Papers, benchmarks, datasets worth tracking." },
  { key: "competitors", label: "Competitors", icon: Target, description: "Product launches, partnerships, major moves." },
  { key: "funding", label: "Funding", icon: Banknote, description: "Competitor and adjacent rounds." },
]

function FeedItem({ item }: { item: BriefItem }) {
  const headline = item.headline ?? item.title ?? "Untitled"
  const url = item.url
  const source = item.source ?? ""
  const score = typeof item.score === "number" ? item.score : null
  const why = item.whyItMatters ?? item.relevance ?? item.summary
  const strategic = item.strategicImplication
  const action = item.suggestedAction
  const hideAction = !action || (typeof action === "string" && action.includes("No immediate"))

  const Wrapper: React.ElementType = url ? "a" : "div"

  return (
    <Wrapper
      {...(url ? { href: url, target: "_blank", rel: "noopener noreferrer" } : {})}
      className={[
        "group block rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors",
        url ? "hover:bg-white/[0.06] hover:border-indigo-400/40 cursor-pointer" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-[14px] font-medium text-white leading-snug">{headline}</p>
            {score != null && (
              <span className="text-[11px] font-medium text-white/50 tabular-nums shrink-0">{score}/10</span>
            )}
          </div>
          {why && <p className="text-[13px] text-white/70 mt-1.5 leading-relaxed">{why}</p>}
          {strategic && (
            <p className="text-[12px] text-white/60 mt-1.5 leading-relaxed border-l-2 border-indigo-400/40 pl-2.5">
              <span className="font-medium text-white/80">Strategic: </span>
              {strategic}
            </p>
          )}
          {!hideAction && (
            <div className="text-[12px] text-indigo-300 mt-1.5 font-medium leading-snug">→ {action}</div>
          )}
          {source && <p className="text-[11px] font-medium text-indigo-300/80 mt-1.5">{source}</p>}
        </div>
        {url && (
          <ExternalLink className="h-3.5 w-3.5 text-white/30 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </Wrapper>
  )
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20">
          <Icon className="h-4 w-4 text-indigo-300" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-white uppercase tracking-wide">{title}</h2>
          {description && <p className="text-[12px] text-white/50 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function SeverityPill({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone: "critical" | "high" | "medium" | "low"
}) {
  const palette: Record<typeof tone, string> = {
    critical: "bg-red-500/15 text-red-300 border-red-500/30",
    high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    medium: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  }
  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${palette[tone]}`}>
      <span className="text-[12px] font-medium uppercase tracking-wide">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{count}</span>
    </div>
  )
}

export default function IntelligencePreviewPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<PreviewPayload | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/preview/intelligence/${encodeURIComponent(slug)}`, {
          cache: "no-store",
        })
        if (res.status === 404) {
          if (!cancelled) setNotFound(true)
          return
        }
        const json = (await res.json()) as PreviewPayload
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setNotFound(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <Lock className="h-10 w-10 text-white/30 mx-auto mb-3" />
          <p className="text-white/60 text-sm">This preview link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    )
  }

  const dashboard: BriefDashboard = data.brief?.content?.dashboard ?? {}
  const hasAnySignal = SIGNAL_SECTIONS.some(({ key }) => (dashboard[key]?.length ?? 0) > 0)
  const headerName = data.companyName ?? data.label
  const briefAge = data.brief ? formatDistanceToNow(new Date(data.brief.created_at), { addSuffix: true }) : null

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <header className="border-b border-white/10 bg-white/[0.02] backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
              <Radio className="h-4 w-4 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-white truncate">{headerName}</p>
              <p className="text-[12px] text-white/50 truncate">
                Intelligence feed · read-only preview
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-300 shrink-0">
            <Lock className="h-3 w-3" />
            Locked preview
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {briefAge && (
          <p className="text-[12px] text-white/40">Last updated {briefAge}</p>
        )}

        {/* Security alerts strip */}
        {data.features.securityAlerts && data.securityCounts && data.securityCounts.total > 0 && (
          <SectionCard
            icon={Shield}
            title="Security alerts"
            description="Open alerts from the CISO pipeline."
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <SeverityPill label="Critical" count={data.securityCounts.critical} tone="critical" />
              <SeverityPill label="High" count={data.securityCounts.high} tone="high" />
              <SeverityPill label="Medium" count={data.securityCounts.medium} tone="medium" />
              <SeverityPill label="Low" count={data.securityCounts.low} tone="low" />
            </div>
          </SectionCard>
        )}

        {/* Hot intent signal */}
        {data.features.intentSignals && data.hotIntentCount > 0 && (
          <SectionCard
            icon={Flame}
            title="Hot buyer signals"
            description="New Reddit intent signals scored 8+ and still unaddressed."
          >
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-semibold text-orange-300 tabular-nums">{data.hotIntentCount}</span>
              <span className="text-[13px] text-white/60">
                high-intent conversations waiting for a reply
              </span>
            </div>
          </SectionCard>
        )}

        {/* Signal feed */}
        {data.features.signalFeed && (
          hasAnySignal ? (
            <div className="space-y-5">
              {SIGNAL_SECTIONS.map(({ key, label, icon: Icon, description }) => {
                const items = dashboard[key] ?? []
                if (items.length === 0) return null
                return (
                  <SectionCard key={key} icon={Icon} title={label} description={description}>
                    <div className="space-y-2">
                      {items.map((item, i) => (
                        <FeedItem key={i} item={item} />
                      ))}
                    </div>
                  </SectionCard>
                )
              })}
            </div>
          ) : (
            <SectionCard icon={Radio} title="Signal feed">
              <p className="text-[13px] text-white/50">
                No brief generated yet. The daily intelligence run will populate this feed.
              </p>
            </SectionCard>
          )
        )}

        {/* Behavioral updates */}
        {data.features.behavioral && data.behavioralUpdates && (
          <SectionCard
            icon={Users}
            title="Customer behavior"
            description={`${data.behavioralUpdates.conversationCount} Reddit conversations analyzed${
              data.behavioralUpdates.subreddits.length > 0
                ? ` across ${data.behavioralUpdates.subreddits.slice(0, 3).join(", ")}`
                : ""
            }`}
          >
            <div className="space-y-4">
              {data.behavioralUpdates.summary.overview && (
                <p className="text-[13px] text-white/80 leading-relaxed">
                  {data.behavioralUpdates.summary.overview}
                </p>
              )}
              {data.behavioralUpdates.summary.themes.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50 mb-2">
                    Themes
                  </p>
                  <div className="space-y-2">
                    {data.behavioralUpdates.summary.themes.slice(0, 4).map((theme, i) => (
                      <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                        <p className="text-[13px] font-medium text-white">{theme.title}</p>
                        <p className="text-[12px] text-white/60 mt-0.5 leading-relaxed">{theme.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.behavioralUpdates.summary.painPoints.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50 mb-2">
                    Pain points
                  </p>
                  <ul className="space-y-1.5">
                    {data.behavioralUpdates.summary.painPoints.slice(0, 5).map((point, i) => (
                      <li key={i} className="text-[13px] text-white/75 flex gap-2">
                        <span className="text-indigo-300 shrink-0">→</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.behavioralUpdates.summary.nextMoves.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50 mb-2">
                    Suggested moves
                  </p>
                  <ul className="space-y-1.5">
                    {data.behavioralUpdates.summary.nextMoves.slice(0, 4).map((move, i) => (
                      <li key={i} className="text-[13px] text-indigo-200 flex gap-2">
                        <span className="shrink-0">{i + 1}.</span>
                        <span>{move}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {!data.brief && !data.behavioralUpdates && data.hotIntentCount === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
            <Radio className="h-8 w-8 text-white/20 mx-auto mb-3" />
            <p className="text-[14px] text-white/60">The intelligence feed is still warming up.</p>
            <p className="text-[12px] text-white/40 mt-1">
              Agents run on schedule, new signals will land here within 24 hours.
            </p>
          </div>
        )}

        <footer className="border-t border-white/10 pt-6 text-center text-[11px] text-white/30">
          Powered by Juno · Read-only intelligence preview. Login required to act on any signal.
        </footer>
      </main>
    </div>
  )
}

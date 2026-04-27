"use client"

import { useCallback, useState } from "react"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  Building2,
  Calendar,
  ExternalLink,
  Eye,
  Loader2,
  RefreshCw,
  Scale,
  TrendingUp,
} from "lucide-react"

type TimelineEvent = {
  date: string
  actor: string
  event: string
  significance: string
  sourceUrl?: string | null
}

type FirmProfile = {
  name: string
  stance: string
  moves: string
  quote?: string | null
  assessment: string
}

type MustKnowHeadline = {
  date: string
  title: string
  source: string
  whyItMatters: string
  companyRelevance: string
  sourceUrl?: string | null
}

type RiskOpportunity = {
  theme: string
  risk: string
  opportunity: string
  whoShouldCare: string
}

type SourceRegisterItem = {
  date: string
  title: string
  source: string
  sourceUrl?: string | null
  relevanceTier: "critical" | "important" | "watch"
  reason: string
}

type StateOfPlayItem = {
  theme: string
  whatChanged: string
  whyItMatters: string
  whoIsAffected: string
  sourceUrls?: string[]
}

type ChangeLogItem = {
  date: string
  category: string
  actor: string
  change: string
  impact: string
  sourceUrl?: string | null
}

type StakeholderBriefing = {
  stakeholderType: string
  nowTrue: string
  implication: string
  action: string
}

type AuditDigest = {
  headline: string
  subhead: string
  executiveSummary: string
  industryAlignmentMemo?: string
  stateOfPlay?: StateOfPlayItem[]
  changeLog?: ChangeLogItem[]
  mustKnowHeadlines?: MustKnowHeadline[]
  timeline: TimelineEvent[]
  firmProfiles: FirmProfile[]
  regulatoryLandscape: string
  technologyLandscape?: string
  educationAndWorkforceLandscape?: string
  marketImplications: string
  riskAndOpportunityMap?: RiskOpportunity[]
  stakeholderBriefings?: StakeholderBriefing[]
  whatToWatch: string[]
  sourceRegister?: SourceRegisterItem[]
  coverageNotes?: string
  rawSourceCount: number
}

export function AuditAiDigest() {
  const [digest, setDigest] = useState<AuditDigest | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [sourceCount, setSourceCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [industry, setIndustry] = useState("")

  const loadCached = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/content-feed/audit-digest")
      if (!res.ok) {
        setError("Failed to load cached digest.")
        return
      }
      const data = await res.json()
      if (data.companyName) setCompanyName(data.companyName)
      if (data.industry) setIndustry(data.industry)
      if (data.digest) {
        setDigest(data.digest as AuditDigest)
        setGeneratedAt(data.generatedAt ?? null)
        setSourceCount(data.digest.rawSourceCount ?? 0)
      }
    } catch {
      setError("Network error.")
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [])

  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/content-feed/audit-digest", { method: "POST" })
      const raw = await res.text()
      let data: {
        digest?: AuditDigest
        error?: string
        generatedAt?: string
        sourceCount?: number
        companyName?: string
        industry?: string
      } = {}
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {}
      } catch {
        setError(
          res.ok
            ? "Invalid response from server."
            : `Request failed (HTTP ${res.status}). ${raw.replace(/<[^>]+>/g, " ").slice(0, 180).trim()}`,
        )
        return
      }
      if (!res.ok) {
        setError(data.error || `Request failed (HTTP ${res.status}).`)
        return
      }
      if (data.companyName) setCompanyName(data.companyName)
      if (data.industry) setIndustry(data.industry)
      if (data.digest) {
        setDigest(data.digest as AuditDigest)
        setGeneratedAt(data.generatedAt ?? null)
        setSourceCount(data.sourceCount ?? data.digest.rawSourceCount ?? 0)
      } else {
        setError(data.error || "No results. Try again later.")
      }
    } catch {
      setError("Network error during generation.")
    } finally {
      setGenerating(false)
    }
  }, [])

  if (!loaded && !loading) {
    loadCached()
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 bg-gradient-to-r from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              45 Days of Accounting & Audit Intelligence
            </h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {companyName ? `Market intelligence for ${companyName}.` : "Compile signals from your market."}
              {generatedAt ? ` Last compiled: ${new Date(generatedAt).toLocaleDateString()}.` : ""}
              {sourceCount > 0 ? ` ${sourceCount} sources analyzed.` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {digest && (
            <button
              onClick={loadCached}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded"
              title="Refresh from cache"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          )}
          <button
            onClick={generate}
            disabled={generating}
            className={cn(
              "text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors",
              "bg-amber-600 text-white hover:bg-amber-700",
              "dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-black",
              generating && "opacity-60 cursor-not-allowed",
            )}
          >
            {generating ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Compiling...
              </span>
            ) : digest ? (
              "Recompile"
            ) : (
              "Compile digest"
            )}
          </button>
        </div>
      </div>

      <div className="p-5">
        {loading && !digest ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error && !digest ? (
          <div className="py-12 text-center">
            <p className="text-[13px] text-destructive">{error}</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Hit &quot;Compile digest&quot; to pull 45 days of accounting and audit signals for your company.
            </p>
          </div>
        ) : !digest ? (
          <div className="py-12 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-[14px] text-foreground font-medium">No digest compiled yet</p>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-md mx-auto">
              Compiles 45 days of accounting, auditing, reporting, regulatory, and AI-in-audit signals into an in-depth brief tailored to{" "}
              {companyName || "your company"}&apos;s context, ICP, and competitive landscape.
            </p>
          </div>
        ) : (
          <DigestContent digest={digest} />
        )}
      </div>
    </section>
  )
}

function DigestContent({ digest }: { digest: AuditDigest }) {
  return (
    <div className="space-y-8">
      {/* Headline + Lede */}
      <div>
        <h3 className="text-xl font-bold text-foreground leading-tight">{digest.headline}</h3>
        {digest.subhead && (
          <p className="text-[14px] text-muted-foreground mt-1">{digest.subhead}</p>
        )}
      </div>

      {digest.executiveSummary && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {digest.executiveSummary.split("\n").filter(Boolean).map((p, i) => (
            <p key={i} className="text-[13px] text-foreground/90 leading-relaxed">{p}</p>
          ))}
        </div>
      )}

      {/* Industry alignment memo */}
      {digest.industryAlignmentMemo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/15">
          <SectionHeading icon={BookOpen} label="Industry alignment memo" />
          <div className="mt-3 prose prose-sm dark:prose-invert max-w-none">
            {digest.industryAlignmentMemo.split("\n").filter(Boolean).map((p, i) => (
              <p key={i} className="text-[13px] text-foreground/90 leading-relaxed">{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* State of play */}
      {Array.isArray(digest.stateOfPlay) && digest.stateOfPlay.length > 0 && (
        <div>
          <SectionHeading icon={TrendingUp} label="State of play" count={digest.stateOfPlay.length} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {digest.stateOfPlay.map((item, i) => (
              <div key={`${item.theme}-${i}`} className="rounded-lg border border-border p-4 bg-muted/20">
                <p className="text-[13px] font-semibold text-foreground">{item.theme}</p>
                <p className="mt-2 text-[12px] text-foreground/85 leading-relaxed">
                  <span className="font-medium text-foreground">Changed: </span>
                  {item.whatChanged}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/80">Why it matters: </span>
                  {item.whyItMatters}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.whoIsAffected}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Must-know headlines */}
      {Array.isArray(digest.mustKnowHeadlines) && digest.mustKnowHeadlines.length > 0 && (
        <div>
          <SectionHeading icon={BookOpen} label="Must-know headlines" count={digest.mustKnowHeadlines.length} />
          <div className="mt-3 space-y-2">
            {digest.mustKnowHeadlines.map((item, i) => (
              <div key={`${item.sourceUrl ?? item.title}-${i}`} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatShortDate(item.date)} - {item.source}
                    </p>
                  </div>
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      Source <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <p className="mt-2 text-[12px] text-foreground/85 leading-relaxed">{item.whyItMatters}</p>
                <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/80">Company relevance: </span>
                  {item.companyRelevance}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change log */}
      {Array.isArray(digest.changeLog) && digest.changeLog.length > 0 && (
        <div>
          <SectionHeading icon={Calendar} label="Material change log" count={digest.changeLog.length} />
          <div className="mt-3 divide-y divide-border rounded-lg border border-border">
            {digest.changeLog.map((item, i) => (
              <div key={`${item.actor}-${item.change}-${i}`} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">
                      {formatShortDate(item.date)} - {item.actor}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.category}</p>
                  </div>
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      Source <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <p className="mt-2 text-[12px] text-foreground/85 leading-relaxed">{item.change}</p>
                <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">{item.impact}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {Array.isArray(digest.timeline) && digest.timeline.length > 0 && (
        <div>
          <SectionHeading icon={Calendar} label="Timeline" count={digest.timeline.length} />
          <div className="mt-3 space-y-3">
            {digest.timeline.map((ev, i) => (
              <div key={i} className="flex gap-3 group">
                <div className="w-[72px] shrink-0 text-right">
                  <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                    {ev.date === "recent" ? "Recent" : formatShortDate(ev.date)}
                  </span>
                </div>
                <div className="border-l-2 border-amber-300 dark:border-amber-700 pl-3 pb-1 min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">{ev.actor}</p>
                  <p className="text-[13px] text-foreground mt-0.5">{ev.event}</p>
                  <p className="text-[12px] text-muted-foreground mt-1">{ev.significance}</p>
                  {ev.sourceUrl && (
                    <a
                      href={ev.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                    >
                      Source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Firm Profiles */}
      {Array.isArray(digest.firmProfiles) && digest.firmProfiles.length > 0 && (
        <div>
          <SectionHeading icon={Building2} label="Firm-by-firm breakdown" count={digest.firmProfiles.length} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {digest.firmProfiles.map((firm, i) => (
              <div key={i} className="rounded-lg border border-border p-4 bg-muted/20">
                <p className="text-[14px] font-semibold text-foreground">{firm.name}</p>
                <p className="text-[12px] text-amber-700 dark:text-amber-400 font-medium mt-0.5">{firm.stance}</p>
                <p className="text-[12px] text-foreground/85 mt-2 leading-relaxed">{firm.moves}</p>
                {firm.quote && (
                  <blockquote className="text-[12px] text-muted-foreground italic mt-2 border-l-2 border-border pl-2">
                    "{firm.quote}"
                  </blockquote>
                )}
                <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
                  <span className="font-medium text-foreground/80">Assessment: </span>
                  {firm.assessment}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regulatory */}
      {digest.regulatoryLandscape && (
        <div>
          <SectionHeading icon={Scale} label="Regulatory landscape" />
          <div className="mt-2 prose prose-sm dark:prose-invert max-w-none">
            {digest.regulatoryLandscape.split("\n").filter(Boolean).map((p, i) => (
              <p key={i} className="text-[13px] text-foreground/90 leading-relaxed">{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Technology */}
      {digest.technologyLandscape && (
        <div>
          <SectionHeading icon={TrendingUp} label="Technology landscape" />
          <div className="mt-2 prose prose-sm dark:prose-invert max-w-none">
            {digest.technologyLandscape.split("\n").filter(Boolean).map((p, i) => (
              <p key={i} className="text-[13px] text-foreground/90 leading-relaxed">{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Education and workforce */}
      {digest.educationAndWorkforceLandscape && (
        <div>
          <SectionHeading icon={Building2} label="Education and workforce" />
          <div className="mt-2 prose prose-sm dark:prose-invert max-w-none">
            {digest.educationAndWorkforceLandscape.split("\n").filter(Boolean).map((p, i) => (
              <p key={i} className="text-[13px] text-foreground/90 leading-relaxed">{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Market implications */}
      {digest.marketImplications && (
        <div>
          <SectionHeading icon={TrendingUp} label="Market implications" />
          <div className="mt-2 prose prose-sm dark:prose-invert max-w-none">
            {digest.marketImplications.split("\n").filter(Boolean).map((p, i) => (
              <p key={i} className="text-[13px] text-foreground/90 leading-relaxed">{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Stakeholder briefings */}
      {Array.isArray(digest.stakeholderBriefings) && digest.stakeholderBriefings.length > 0 && (
        <div>
          <SectionHeading icon={Eye} label="Stakeholder briefings" count={digest.stakeholderBriefings.length} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {digest.stakeholderBriefings.map((item, i) => (
              <div key={`${item.stakeholderType}-${i}`} className="rounded-lg border border-border p-4">
                <p className="text-[13px] font-semibold text-foreground">
                  {item.stakeholderType.replace(/_/g, " ")}
                </p>
                <p className="mt-2 text-[12px] text-foreground/85 leading-relaxed">
                  <span className="font-medium text-foreground">Now true: </span>
                  {item.nowTrue}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/80">Implication: </span>
                  {item.implication}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/80">Action: </span>
                  {item.action}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk and opportunity */}
      {Array.isArray(digest.riskAndOpportunityMap) && digest.riskAndOpportunityMap.length > 0 && (
        <div>
          <SectionHeading icon={Scale} label="Risk and opportunity map" count={digest.riskAndOpportunityMap.length} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {digest.riskAndOpportunityMap.map((item, i) => (
              <div key={`${item.theme}-${i}`} className="rounded-lg border border-border p-4 bg-muted/20">
                <p className="text-[13px] font-semibold text-foreground">{item.theme}</p>
                <p className="mt-2 text-[12px] text-foreground/85 leading-relaxed">
                  <span className="font-medium text-destructive">Risk: </span>
                  {item.risk}
                </p>
                <p className="mt-1 text-[12px] text-foreground/85 leading-relaxed">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">Opportunity: </span>
                  {item.opportunity}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">{item.whoShouldCare}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What to watch */}
      {Array.isArray(digest.whatToWatch) && digest.whatToWatch.length > 0 && (
        <div>
          <SectionHeading icon={Eye} label="What to watch next" count={digest.whatToWatch.length} />
          <ul className="mt-2 space-y-1.5">
            {digest.whatToWatch.map((item, i) => (
              <li key={i} className="flex gap-2 text-[13px] text-foreground/90 leading-relaxed">
                <span className="text-amber-600 dark:text-amber-400 font-semibold shrink-0">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Source register */}
      {Array.isArray(digest.sourceRegister) && digest.sourceRegister.length > 0 && (
        <div>
          <SectionHeading icon={ExternalLink} label="Source register" count={digest.sourceRegister.length} />
          <div className="mt-3 divide-y divide-border rounded-lg border border-border">
            {digest.sourceRegister.map((item, i) => (
              <div key={`${item.sourceUrl ?? item.title}-${i}`} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatShortDate(item.date)} - {item.source} - {item.relevanceTier}
                    </p>
                  </div>
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">{item.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {digest.coverageNotes && (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <SectionHeading icon={Eye} label="Coverage notes" />
          <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">{digest.coverageNotes}</p>
        </div>
      )}
    </div>
  )
}

function SectionHeading({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Calendar
  label: string
  count?: number
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {typeof count === "number" && (
          <span className="font-normal normal-case ml-1.5 text-[11px]">({count})</span>
        )}
      </h4>
    </div>
  )
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return dateStr
  }
}

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

type AuditDigest = {
  headline: string
  subhead: string
  executiveSummary: string
  timeline: TimelineEvent[]
  firmProfiles: FirmProfile[]
  regulatoryLandscape: string
  marketImplications: string
  whatToWatch: string[]
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
              45 Days of AI in {industry || companyName || "Your Market"}
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
              Hit &quot;Compile digest&quot; to pull 45 days of market signals for your company and synthesize via OpenRouter.
            </p>
          </div>
        ) : !digest ? (
          <div className="py-12 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-[14px] text-foreground font-medium">No digest compiled yet</p>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-md mx-auto">
              Compiles 45 days of market signals from Google News into an in-depth feature — tailored to{" "}
              {companyName || "your company"}&apos;s industry, ICP, and competitive landscape.
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

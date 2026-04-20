"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Zap,
  Bot,
  FileText,
  Target,
  Banknote,
  ExternalLink,
  Loader2,
  RefreshCw,
  Star,
  SendHorizonal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

type BriefItem = {
  title?: string
  headline?: string
  url?: string
  source?: string
  relevance?: string
  summary?: string
  score?: number
  /** Strategic intelligence layers (daily brief scoring) */
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

type FeedRow = {
  id: string
  content: BriefContent
  created_at: string
}

type StarredFeedItem = {
  id: string
  section: string
  savedAt: string
  item: BriefItem
}

const STARRED_FEED_STORAGE_KEY = "juno.signal-feed.starred"

const SECTIONS: {
  key: keyof BriefDashboard
  label: string
  icon: typeof Zap
  description: string
}[] = [
  { key: "breaking", label: "Breaking", icon: Zap, description: "Time-sensitive news that may affect your market." },
  { key: "ai_tools", label: "AI & tools", icon: Bot, description: "Model and product releases mapped to your space." },
  { key: "research", label: "Research", icon: FileText, description: "Papers, benchmarks, datasets (arXiv, journals)." },
  { key: "competitors", label: "Competitors", icon: Target, description: "Product launches, partnerships, major moves." },
  { key: "funding", label: "Funding", icon: Banknote, description: "Competitor and adjacent rounds to watch." },
]

function itemStableId(item: BriefItem, sectionKey: keyof BriefDashboard) {
  const headline = item.headline ?? item.title ?? ""
  const source = item.source ?? ""
  const url = item.url ?? ""
  return `${sectionKey}::${headline}::${source}::${url}`.toLowerCase()
}

function readStarredFeedItems() {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STARRED_FEED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (row): row is StarredFeedItem =>
        !!row &&
        typeof row === "object" &&
        typeof (row as StarredFeedItem).id === "string" &&
        typeof (row as StarredFeedItem).section === "string" &&
        typeof (row as StarredFeedItem).savedAt === "string" &&
        typeof (row as StarredFeedItem).item === "object",
    )
  } catch {
    return []
  }
}

function writeStarredFeedItems(rows: StarredFeedItem[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STARRED_FEED_STORAGE_KEY, JSON.stringify(rows))
}

function FeedItem({
  item,
  starred = false,
  onToggleStar,
}: {
  item: BriefItem
  starred?: boolean
  onToggleStar?: () => void
}) {
  const headline = item.headline ?? item.title ?? "Untitled"
  const url = item.url
  const source = item.source ?? ""
  const score = typeof item.score === "number" ? item.score : null
  const why = item.whyItMatters ?? item.relevance ?? item.summary
  const strategic = item.strategicImplication
  const action = item.suggestedAction
  const roadmap = item.connectionToRoadmap
  const hideAction = !action || (typeof action === "string" && action.includes("No immediate"))

  const handleClick = () => {
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <div
      role={url ? "button" : undefined}
      tabIndex={url ? 0 : undefined}
      onClick={url ? handleClick : undefined}
      onKeyDown={url ? (e) => e.key === "Enter" && handleClick() : undefined}
      className={cn(
        "group rounded-md border border-border/80 bg-background px-3 py-2.5 -mx-1",
        url && "hover:bg-muted/80 hover:border-primary/30 cursor-pointer select-none",
        "transition-colors",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-[13px] font-medium text-foreground leading-snug">{headline}</p>
            {score != null && (
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">
                {score}/10
              </span>
            )}
          </div>
          {why && (
            <p className="text-[12px] text-foreground/90 mt-1.5 leading-relaxed">{why}</p>
          )}
          {strategic && (
            <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed border-l-2 border-primary/25 pl-2">
              <span className="font-medium text-foreground/80">Strategic: </span>
              {strategic}
            </p>
          )}
          {!hideAction && (
            <div className="text-[12px] text-primary/95 mt-1.5 font-medium leading-snug">
              → {action}
            </div>
          )}
          {roadmap && (
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed flex gap-1.5">
              <span aria-hidden>📍</span>
              <span>{roadmap}</span>
            </p>
          )}
          {source && (
            <div className="flex items-center gap-x-2 mt-1.5">
              <span className="text-[11px] font-medium text-primary/90">{source}</span>
            </div>
          )}
        </div>
        {url && (
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
        {onToggleStar ? (
          <button
            type="button"
            aria-label={starred ? "Unstar update" : "Star update"}
            title={starred ? "Unstar update" : "Star update"}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleStar()
            }}
            className={cn(
              "rounded p-1 transition-colors",
              starred
                ? "text-amber-500 hover:text-amber-600"
                : "text-muted-foreground/60 hover:text-foreground",
            )}
          >
            <Star className={cn("h-3.5 w-3.5", starred && "fill-current")} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

type FounderDailyFeedProps = {
  className?: string
  /** Card heading (default: Signal feed). */
  title?: string
  /** Replaces the default CBS brief subtitle line when set. */
  subtitle?: string
}

type WorkspaceProfile = {
  company_name?: string | null
  company_description?: string | null
  problem?: string | null
  solution?: string | null
  target_market?: string | null
  traction?: string | null
  founder_name?: string | null
  stage?: string | null
  icp?: string[]
  competitors?: string[]
  priorities?: string[]
  risks?: string[]
  keywords?: string[]
}

export function FounderDailyFeed({ className, title, subtitle }: FounderDailyFeedProps) {
  const [brief, setBrief] = useState<FeedRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [workspaceScope, setWorkspaceScope] = useState(false)
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)
  const [workspaceProfile, setWorkspaceProfile] = useState<WorkspaceProfile | null>(null)
  const [starredItems, setStarredItems] = useState<StarredFeedItem[]>([])
  const [researchQuestion, setResearchQuestion] = useState("")
  const [researchQuerying, setResearchQuerying] = useState(false)
  const [researchQueryError, setResearchQueryError] = useState<string | null>(null)
  const [researchQueryResult, setResearchQueryResult] = useState<{
    answer: string
    keyFindings: string[]
    sources: { title: string; url: string; source: string | null; relevance_score: number | null }[]
    evidenceCount: number
  } | null>(null)

  useEffect(() => {
    setStarredItems(readStarredFeedItems())
  }, [])

  const persistStarredItems = useCallback((next: StarredFeedItem[]) => {
    setStarredItems(next)
    writeStarredFeedItems(next)
  }, [])

  const isStarred = useCallback(
    (id: string) => starredItems.some((row) => row.id === id),
    [starredItems],
  )

  const toggleStarred = useCallback(
    (section: keyof BriefDashboard, sectionLabel: string, item: BriefItem) => {
      const id = itemStableId(item, section)
      const alreadyStarred = starredItems.some((row) => row.id === id)
      if (alreadyStarred) {
        persistStarredItems(starredItems.filter((row) => row.id !== id))
        return
      }
      const next: StarredFeedItem[] = [
        { id, section: sectionLabel, savedAt: new Date().toISOString(), item },
        ...starredItems,
      ]
      persistStarredItems(next.slice(0, 120))
    },
    [persistStarredItems, starredItems],
  )

  const fetchFeed = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/intelligence/feed")
      if (!res.ok) return
      const data = await res.json()
      if (data.workspaceScope) {
        setWorkspaceScope(true)
        setWorkspaceName(data.workspaceName ?? null)
        setWorkspaceProfile(data.workspaceProfile ?? null)
        setBrief(null)
      } else {
        setWorkspaceScope(false)
        setWorkspaceName(null)
        setWorkspaceProfile(null)
        setBrief(data.brief ?? null)
      }
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFeed()
  }, [fetchFeed])

  const dashboard: BriefDashboard = brief?.content?.dashboard ?? {}
  const hasBrief = !!brief
  const briefAge = brief ? formatDistanceToNow(new Date(brief.created_at), { addSuffix: true }) : null

  const askResearchQuestion = useCallback(async () => {
    if (!researchQuestion.trim() || researchQuerying || workspaceScope || loading) return
    setResearchQuerying(true)
    setResearchQueryError(null)
    setResearchQueryResult(null)
    try {
      const res = await fetch("/api/intelligence/research-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: researchQuestion.trim() }),
      })
      let json: {
        answer?: string
        keyFindings?: string[]
        sources?: { title: string; url: string; source: string | null; relevance_score: number | null }[]
        evidenceCount?: number
        error?: string
      } = {}
      try {
        json = await res.json()
      } catch {
        /* non-JSON */
      }
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Query failed")
      setResearchQueryResult({
        answer: json.answer ?? "",
        keyFindings: json.keyFindings ?? [],
        sources: json.sources ?? [],
        evidenceCount: json.evidenceCount ?? 0,
      })
    } catch (e) {
      setResearchQueryError(e instanceof Error ? e.message : "Query failed")
    } finally {
      setResearchQuerying(false)
    }
  }, [loading, researchQuestion, researchQuerying, workspaceScope])

  return (
    <section
      className={cn(
        "rounded-lg border-2 border-primary/25 bg-card text-foreground shadow-sm flex flex-col",
        "min-h-[280px] max-h-[min(80vh,880px)] lg:max-h-[calc(100vh-7rem)] overflow-hidden",
        className,
      )}
    >
      <div className="px-4 py-3 border-b border-border bg-primary/5 shrink-0 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title ?? "Signal feed"}</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {subtitle !== undefined
              ? subtitle
              : loading
                ? "Loading…"
                : workspaceScope
                  ? `${workspaceName ?? "Client"} workspace context`
                  : hasBrief
                    ? `CBS brief · ${briefAge}`
                    : "No brief yet — CBS pipeline runs at 05:00"}
          </p>
        </div>
        <button
          onClick={fetchFeed}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded mt-0.5"
          title="Refresh feed"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto min-h-0 flex-1 bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : workspaceScope ? (
          <div className="space-y-4">
            {workspaceProfile ? (
              <>
                {workspaceProfile.company_description && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Company</p>
                    <p className="text-[13px] text-foreground leading-relaxed">{workspaceProfile.company_description}</p>
                  </div>
                )}
                {workspaceProfile.problem && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Problem</p>
                    <p className="text-[13px] text-foreground/90 leading-relaxed">{workspaceProfile.problem}</p>
                  </div>
                )}
                {workspaceProfile.solution && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Solution</p>
                    <p className="text-[13px] text-foreground/90 leading-relaxed">{workspaceProfile.solution}</p>
                  </div>
                )}
                {workspaceProfile.traction && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Traction</p>
                    <p className="text-[13px] text-foreground/90 leading-relaxed">{workspaceProfile.traction}</p>
                  </div>
                )}
                {workspaceProfile.icp && workspaceProfile.icp.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">ICP</p>
                    <ul className="space-y-1">
                      {workspaceProfile.icp.map((item, i) => (
                        <li key={i} className="text-[12px] text-foreground/80 flex gap-1.5">
                          <span className="text-primary shrink-0">→</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {workspaceProfile.competitors && workspaceProfile.competitors.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Competitors</p>
                    <p className="text-[12px] text-foreground/80">{workspaceProfile.competitors.join(", ")}</p>
                  </div>
                )}
                {workspaceProfile.priorities && workspaceProfile.priorities.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Priorities (90 days)</p>
                    <ul className="space-y-1">
                      {workspaceProfile.priorities.map((p, i) => (
                        <li key={i} className="text-[12px] text-foreground/80 flex gap-1.5">
                          <span className="text-primary shrink-0">{i + 1}.</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-[13px] text-muted-foreground">No context submitted for {workspaceName ?? "this workspace"} yet.</p>
                <p className="text-[12px] text-muted-foreground/70 mt-1">Share the intake link to collect their company context.</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border/80 bg-muted/10 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ask the data</p>
              </div>
              <p className="text-[12px] font-medium text-foreground leading-snug">Query your research corpus</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Answers use papers and technical items from recent daily briefs (for example arXiv), plus your saved company context and vault grounding when connected.
              </p>
              <div className="flex gap-2 pt-0.5">
                <Input
                  value={researchQuestion}
                  onChange={(e) => setResearchQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void askResearchQuestion()
                  }}
                  placeholder='e.g. What is the SSOT standard for agents?'
                  className="h-9 text-[12px]"
                  disabled={researchQuerying}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void askResearchQuestion()}
                  disabled={researchQuerying || !researchQuestion.trim()}
                  className="shrink-0 gap-1.5 h-9 px-3"
                >
                  {researchQuerying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <SendHorizonal className="h-3.5 w-3.5" />
                  )}
                  {researchQuerying ? "…" : "Ask"}
                </Button>
              </div>
              {researchQueryError ? (
                <p className="text-[11px] text-destructive border border-destructive/20 bg-destructive/5 rounded px-2 py-1.5">
                  {researchQueryError}
                </p>
              ) : null}
              {researchQueryResult ? (
                <div className="space-y-2 pt-1 border-t border-border/60">
                  <p className="text-[11px] font-medium text-foreground">Answer</p>
                  <p className="text-[12px] text-foreground/90 leading-relaxed">{researchQueryResult.answer}</p>
                  {researchQueryResult.keyFindings.length > 0 ? (
                    <ul className="space-y-1">
                      {researchQueryResult.keyFindings.map((finding) => (
                        <li key={finding} className="text-[11px] text-foreground/85 flex gap-1.5 leading-relaxed">
                          <span className="text-primary shrink-0">·</span>
                          {finding}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-[10px] text-muted-foreground">
                    Grounded in {researchQueryResult.evidenceCount} research item
                    {researchQueryResult.evidenceCount === 1 ? "" : "s"} from recent briefs
                  </p>
                  {researchQueryResult.sources.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sources cited</p>
                      {researchQueryResult.sources.map((s) => (
                        <a
                          key={s.url}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex flex-col gap-0.5 rounded border border-border/60 bg-background/80 px-2 py-1.5 hover:border-primary/40 transition-colors"
                        >
                          <span className="text-[11px] font-medium text-primary leading-snug">{s.title}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {[s.source, s.relevance_score != null ? `${s.relevance_score}/10` : null].filter(Boolean).join(" · ")}
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!hasBrief ? (
              <div className="py-6 text-center border border-dashed border-border rounded-lg bg-muted/10">
                <p className="text-[13px] text-muted-foreground">No brief in the feed yet.</p>
                <p className="text-[12px] text-muted-foreground/70 mt-1 px-4">
                  Your daily brief runs around 05:00 once your company profile is set up. You can still ask above if older briefs already contain research items.
                </p>
              </div>
            ) : (
              <>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Starred updates
                  <span className="font-normal normal-case ml-1.5 text-[11px]">· {starredItems.length}</span>
                </h3>
              </div>
              {starredItems.length === 0 ? (
                <p className="text-[12px] text-muted-foreground/70 italic py-2 px-1 border border-dashed border-border rounded-md bg-muted/20">
                  Star an update to keep it handy for later.
                </p>
              ) : (
                <div className="space-y-1 divide-y divide-border/60">
                  {starredItems.map((row) => (
                    <FeedItem
                      key={row.id}
                      item={row.item}
                      starred={isStarred(row.id)}
                      onToggleStar={() => persistStarredItems(starredItems.filter((item) => item.id !== row.id))}
                    />
                  ))}
                </div>
              )}
            </div>

            {SECTIONS.map((section) => {
            const Icon = section.icon
            const items: BriefItem[] = (dashboard[section.key] as BriefItem[] | undefined) ?? []
            return (
              <div key={section.key}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.label}
                    {items.length > 0 && (
                      <span className="font-normal normal-case ml-1.5 text-[11px]">· {items.length}</span>
                    )}
                  </h3>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">{section.description}</p>

                {items.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground/70 italic py-2 px-1 border border-dashed border-border rounded-md bg-muted/20">
                    Nothing new in this category today.
                  </p>
                ) : (
                  <div className="space-y-1 divide-y divide-border/60">
                    {items.map((item, i) => (
                      <FeedItem
                        key={i}
                        item={item}
                        starred={isStarred(itemStableId(item, section.key))}
                        onToggleStar={() => toggleStarred(section.key, section.label, item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
            })}
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { Calendar, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  buildCollaborationViewModel,
  type AgentOrbStatus,
  type BuildCollaborationOptions,
  type CollaborationViewModel,
  type IntelligenceFeedPayload,
} from "@/lib/staff-meeting-collaboration"

type BadgeVariant =
  | "high"
  | "medium"
  | "low"
  | "today"
  | "this_week"
  | "backlog"
  | "urgent"
  | "warm"
  | "pending"
  | "completed"
  | "pending_approval"
  | "idle"
  | "default"

const BADGE_COLORS: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  high: { bg: "#FCEBEB", text: "#791F1F", border: "#F09595" },
  medium: { bg: "#FAEEDA", text: "#633806", border: "#FAC775" },
  low: { bg: "#EAF3DE", text: "#27500A", border: "#C0DD97" },
  today: { bg: "#FCEBEB", text: "#791F1F", border: "#F09595" },
  this_week: { bg: "#FAEEDA", text: "#633806", border: "#FAC775" },
  backlog: { bg: "#E8E8E6", text: "#444441", border: "#C9C7C0" },
  urgent: { bg: "#FCEBEB", text: "#791F1F", border: "#F09595" },
  warm: { bg: "#FAEEDA", text: "#633806", border: "#FAC775" },
  pending: { bg: "#FAEEDA", text: "#633806", border: "#FAC775" },
  completed: { bg: "#EAF3DE", text: "#27500A", border: "#C0DD97" },
  pending_approval: { bg: "#E6F1FB", text: "#0C447C", border: "#85B7EB" },
  idle: { bg: "#F1EFE8", text: "#888580", border: "#D3D1C7" },
  default: { bg: "#F1EFE8", text: "#444441", border: "#D3D1C7" },
}

function urgencyVariant(u: string): BadgeVariant {
  if (u === "today" || u === "this_week" || u === "backlog") return u
  return "default"
}

function urgencyLabel(u: string): string {
  if (u === "this_week") return "this week"
  return u.replace(/_/g, " ")
}

function Badge({ text, variant = "default" }: { text: string; variant?: BadgeVariant }) {
  const c = BADGE_COLORS[variant] ?? BADGE_COLORS.default
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 6,
        background: c.bg,
        color: c.text,
        border: `0.5px solid ${c.border}`,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  )
}

function AgentDot({
  status,
}: {
  status: "completed" | "pending_approval" | "idle" | string
}) {
  const color =
    status === "completed"
      ? "#5DCAA5"
      : status === "pending_approval"
        ? "#378ADD"
        : "#D3D1C7"
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  )
}

function Section({
  title,
  badge,
  children,
}: {
  title: string
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{title}</h2>
        {badge}
      </div>
      {children}
    </div>
  )
}

function Card({
  children,
  accent,
  onClick,
  style = {},
}: {
  children: ReactNode
  accent?: string
  onClick?: () => void
  style?: CSSProperties
}) {
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        background: "hsl(var(--card))",
        border: accent ? `1.5px solid ${accent}` : "0.5px solid hsl(var(--border))",
        borderRadius: 10,
        padding: "12px 16px",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px] text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3">
      {children}
    </p>
  )
}

type StaffMeetingHistoryRow = {
  id: string
  content: unknown
  metadata?: unknown
  created_at: string
}

function formatMeetingTabLabel(iso: string) {
  return new Date(iso).toLocaleString("en-IE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function JunoStaffMeetingPanel() {
  const [tab, setTab] = useState<
    "meeting" | "brief" | "leads" | "content" | "tech"
  >("meeting")
  const [feed, setFeed] = useState<IntelligenceFeedPayload | null>(null)
  const [meetings, setMeetings] = useState<StaffMeetingHistoryRow[]>([])
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedMeetingId(null)
  }, [dateFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [feedRes, histRes] = await Promise.all([
        fetch("/api/intelligence/feed"),
        fetch("/api/staff-meetings"),
      ])
      if (!feedRes.ok) {
        if (feedRes.status === 401) {
          setError("Sign in to load agent collaboration.")
          setFeed(null)
          setMeetings([])
          return
        }
        throw new Error("Failed to load intelligence feed")
      }
      const feedJson = (await feedRes.json()) as IntelligenceFeedPayload
      setFeed(feedJson)
      if (histRes.ok) {
        const histJson = (await histRes.json()) as { meetings?: StaffMeetingHistoryRow[] }
        setMeetings(histJson.meetings ?? [])
      } else {
        setMeetings([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load")
      setFeed(null)
      setMeetings([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredMeetings = useMemo(() => {
    if (!dateFilter) return meetings
    return meetings.filter((m) => m.created_at.slice(0, 10) === dateFilter)
  }, [meetings, dateFilter])

  const activeMeetingRow = useMemo(() => {
    if (filteredMeetings.length === 0) {
      if (dateFilter) return null
      const s = feed?.staffMeeting
      if (!s) return null
      return { id: s.id, content: s.content, created_at: s.created_at }
    }
    if (selectedMeetingId) {
      const hit = filteredMeetings.find((m) => m.id === selectedMeetingId)
      if (hit) return hit
    }
    return filteredMeetings[0]
  }, [filteredMeetings, selectedMeetingId, feed, dateFilter])

  const d = useMemo(() => {
    if (!feed) return null
    const override: BuildCollaborationOptions["staffMeetingOverride"] = activeMeetingRow
      ? { content: activeMeetingRow.content, created_at: activeMeetingRow.created_at }
      : null
    return buildCollaborationViewModel(feed, { staffMeetingOverride: override })
  }, [feed, activeMeetingRow])

  const isHistoricalView = Boolean(
    feed?.staffMeeting?.id &&
      activeMeetingRow &&
      activeMeetingRow.id !== feed.staffMeeting?.id,
  )

  if (loading && !d) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-[13px]">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Loading agent collaboration…
      </div>
    )
  }

  if (error && !d) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
        {error}
      </div>
    )
  }

  if (!d) return null

  const todayActions = d.staffMeeting.actions.filter((a) => a.urgency === "today")
  const postStatusRaw = d.content.post.status?.trim() ?? ""
  const hasNoPost = !postStatusRaw || postStatusRaw === "—"
  const contentStatusBadge: BadgeVariant = hasNoPost
    ? "default"
    : postStatusRaw === "pending_approval"
      ? "pending_approval"
      : postStatusRaw === "draft" || postStatusRaw === "pending"
        ? "pending"
        : postStatusRaw === "approved" || postStatusRaw === "published"
          ? "completed"
          : "default"
  const contentStatusLabel = hasNoPost ? "no draft" : postStatusRaw.replace(/_/g, " ")

  return (
    <div
      className="font-sans text-foreground"
      style={{ maxWidth: 900, margin: "0 auto" }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Agents staff meeting
        </p>
        <button
          type="button"
          onClick={() => load()}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide shrink-0">
            Filter by date
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground"
            />
            {dateFilter ? (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="text-[11px] text-primary hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
        {filteredMeetings.length > 0 ? (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
            {filteredMeetings.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMeetingId(m.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[12px] border transition-colors",
                  activeMeetingRow?.id === m.id
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                {formatMeetingTabLabel(m.created_at)}
              </button>
            ))}
          </div>
        ) : dateFilter ? (
          <p className="text-[12px] text-muted-foreground">No staff meetings on this calendar day.</p>
        ) : meetings.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            Previous meetings will appear here after the daily staff meeting runs (08:30 UTC).
          </p>
        ) : null}
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 28,
        }}
      >
        <div>
          <h2 className="text-[22px] font-medium tracking-tight" style={{ margin: "0 0 4px" }}>
            Good morning
          </h2>
          <p className="text-[13px] text-muted-foreground" style={{ margin: 0 }}>
            {d.dateLabel}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {(Object.entries(d.agents) as [keyof CollaborationViewModel["agents"], AgentOrbStatus][]).map(
            ([agent, status]) => (
              <div key={agent} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <AgentDot status={status} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "hsl(var(--muted-foreground))",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {agent}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Staff meeting executive summary */}
      <Card accent="#534AB7" style={{ marginBottom: 24, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#3C3489" }}>Staff meeting</span>
          <span className="text-[11px] text-muted-foreground">{d.meetingTimeLabel}</span>
        </div>
        <p className="text-[14px] leading-relaxed" style={{ margin: "0 0 14px" }}>
          {d.staffMeeting.summary}
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {todayActions.map((a, i) => (
            <button
              key={i}
              type="button"
              className="text-foreground border border-border bg-transparent hover:bg-muted/50"
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer" }}
            >
              {a.text}
            </button>
          ))}
        </div>
      </Card>

      {isHistoricalView && tab !== "meeting" ? (
        <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-[12px] text-amber-200/90 leading-snug">
          Brief, leads, content, and tech radar below reflect the{" "}
          <strong className="text-amber-100">live</strong> intelligence feed (today), not the staff meeting
          date selected above.
        </div>
      ) : null}

      {/* Tab navigation */}
      <div
        className="border-b border-border"
        style={{ display: "flex", gap: 2, marginBottom: 20, flexWrap: "wrap" }}
      >
        {(
          [
            { id: "meeting" as const, label: "Insights" },
            { id: "brief" as const, label: "Daily brief" },
            { id: "leads" as const, label: `Leads (${d.leads.length})` },
            { id: "content" as const, label: "Content" },
            { id: "tech" as const, label: "Tech radar" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "text-foreground border-b-2 border-foreground"
                : "text-muted-foreground border-b-2 border-transparent"
            }
            style={{
              fontSize: 13,
              fontWeight: tab === t.id ? 500 : 400,
              padding: "8px 14px",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              background: "transparent",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "meeting" && (
        <div>
          <Section title="Cross-cutting insights">
            {d.staffMeeting.insights.length === 0 ? (
              <EmptyHint>
                No synthesis yet — the staff meeting runs after your agents publish outputs (daily, 08:30 UTC).
              </EmptyHint>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {d.staffMeeting.insights.map((ins, i) => (
                  <Card key={i}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, flex: 1 }}>{ins.text}</p>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Badge text={ins.sig} variant={ins.sig} />
                        {ins.agents.map((a) => (
                          <Badge key={a} text={a} />
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Section>

          {d.staffMeeting.conflicts.length > 0 && (
            <Section title="Tensions to resolve">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {d.staffMeeting.conflicts.map((c, i) => (
                  <Card key={i} accent="#C4A035">
                    <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 6px" }}>{c.description}</p>
                    <p className="text-[12px] text-muted-foreground" style={{ margin: "0 0 6px" }}>
                      {c.resolution}
                    </p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {c.agents.map((a) => (
                        <Badge key={a} text={a} />
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          <Section title="Action items">
            {d.staffMeeting.actions.length === 0 ? (
              <EmptyHint>Action items appear when the staff meeting synthesis runs.</EmptyHint>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.staffMeeting.actions.map((a, i) => (
                  <div
                    key={i}
                    className="border-b border-border"
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}
                  >
                    <input
                      type="checkbox"
                      style={{ width: 16, height: 16, accentColor: "#534AB7", flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, flex: 1 }}>{a.text}</span>
                    <Badge text={a.owner} />
                    <Badge text={urgencyLabel(a.urgency)} variant={urgencyVariant(a.urgency)} />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Roadmap recommendations">
            {d.staffMeeting.roadmap.length === 0 ? (
              <EmptyHint>Roadmap nudges show up once the synthesis compares agents to your company context.</EmptyHint>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {d.staffMeeting.roadmap.map((r, i) => (
                  <Card key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 4px" }}>{r.rec}</p>
                        <p className="text-[12px] text-muted-foreground" style={{ margin: 0 }}>
                          {r.evidence}
                        </p>
                      </div>
                      <Badge text={r.confidence} variant={r.confidence} />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {tab === "brief" && (
        <div>
          {d.brief.breaking.length > 0 && (
            <Section title="Breaking" badge={<Badge text={`${d.brief.breaking.length}`} variant="high" />}>
              {d.brief.breaking.map((item, i) => (
                <Card key={i} accent="#E24B4A" style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 4px" }}>{item.title}</p>
                  <p className="text-[12px] text-muted-foreground" style={{ margin: "0 0 4px" }}>
                    {item.why}
                  </p>
                  <span className="text-[11px] text-muted-foreground">{item.source}</span>
                </Card>
              ))}
            </Section>
          )}
          <Section title="Today" badge={<Badge text={`${d.brief.today.length}`} variant="medium" />}>
            {d.brief.today.length === 0 ? (
              <EmptyHint>No items in today&apos;s brief yet — CBS runs at 05:00 UTC.</EmptyHint>
            ) : (
              d.brief.today.map((item, i) => (
                <Card key={i} style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 4px" }}>{item.title}</p>
                  <p className="text-[12px] text-muted-foreground" style={{ margin: "0 0 4px" }}>
                    {item.why}
                  </p>
                  <span className="text-[11px] text-muted-foreground">{item.source}</span>
                </Card>
              ))
            )}
          </Section>
          <Section title="Research">
            {d.brief.research.length === 0 ? (
              <EmptyHint>No research picks in the latest brief.</EmptyHint>
            ) : (
              d.brief.research.map((item, i) => (
                <Card key={i} style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 4px" }}>{item.title}</p>
                  <p className="text-[12px] text-muted-foreground" style={{ margin: 0 }}>
                    {item.why}
                  </p>
                </Card>
              ))
            )}
          </Section>
        </div>
      )}

      {tab === "leads" && (
        <Section title="Discovered leads">
          {d.leads.length === 0 ? (
            <EmptyHint>No leads in the queue — CRO scans job boards on a schedule.</EmptyHint>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.leads.map((lead, i) => (
                <Card key={i}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 2px" }}>{lead.company}</p>
                      <p className="text-[12px] text-muted-foreground" style={{ margin: 0 }}>
                        Hiring: {lead.role}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: lead.fit >= 8 ? "#27500A" : "#633806",
                        }}
                      >
                        {lead.fit}/10
                      </span>
                      <Badge text={lead.timing} variant={lead.timing} />
                    </div>
                  </div>
                  <p
                    className="text-[12px] text-muted-foreground"
                    style={{ margin: "0 0 10px", lineHeight: 1.5 }}
                  >
                    {lead.pitch}
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      style={{
                        fontSize: 12,
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: "0.5px solid #5DCAA5",
                        background: "#E1F5EE",
                        color: "#085041",
                        cursor: "pointer",
                      }}
                    >
                      Approve outreach
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground border border-border bg-transparent hover:bg-muted/50"
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer" }}
                    >
                      Skip
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {tab === "content" && (
        <div>
          <Section
            title="LinkedIn post"
            badge={<Badge text={contentStatusLabel} variant={contentStatusBadge} />}
          >
            <Card>
              <p className="text-[12px] font-medium text-muted-foreground" style={{ margin: "0 0 6px" }}>
                Angle: {d.content.post.angle}
              </p>
              {d.content.post.preview ? (
                <p
                  className="text-[13px] leading-relaxed italic text-foreground"
                  style={{ margin: "0 0 14px" }}
                >
                  &ldquo;{d.content.post.preview}
                  {d.content.post.preview.length >= 280 ? "…" : ""}&rdquo;
                </p>
              ) : (
                <EmptyHint>No LinkedIn draft waiting — CMO runs after the daily brief.</EmptyHint>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={{
                    fontSize: 12,
                    padding: "5px 14px",
                    borderRadius: 6,
                    border: "0.5px solid #5DCAA5",
                    background: "#E1F5EE",
                    color: "#085041",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Approve and post
                </button>
                <button
                  type="button"
                  style={{
                    fontSize: 12,
                    padding: "5px 14px",
                    borderRadius: 6,
                    border: "0.5px solid #85B7EB",
                    background: "#E6F1FB",
                    color: "#0C447C",
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-muted-foreground border border-border bg-transparent hover:bg-muted/50"
                  style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer" }}
                >
                  Skip today
                </button>
              </div>
            </Card>
          </Section>
          <Section title="Comments ready" badge={<Badge text={`${d.content.comments} drafted`} />}>
            <p className="text-[13px] text-muted-foreground">
              {d.content.comments} comments drafted on relevant posts in your space. Comments auto-post
              unless you review them.
            </p>
          </Section>
        </div>
      )}

      {tab === "tech" && (
        <Section title="Tech trends">
          {d.techRadar.length === 0 ? (
            <EmptyHint>No radar snapshot yet — CTO runs after market open.</EmptyHint>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.techRadar.map((t, i) => (
                <Card key={i}>
                  <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 4px" }}>{t.trend}</p>
                  <p className="text-[12px] text-muted-foreground" style={{ margin: "0 0 6px" }}>
                    {t.relevance}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#0C447C" }}>Action:</span>
                    <span style={{ fontSize: 12 }}>{t.action}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  )
}

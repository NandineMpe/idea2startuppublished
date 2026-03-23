import type { StaffMeetingSynthesis } from "@/lib/staff-meeting-types"

export type AgentOrbStatus = "completed" | "pending_approval" | "idle"

export type CollaborationViewModel = {
  dateLabel: string
  meetingTimeLabel: string
  staffMeeting: {
    summary: string
    insights: Array<{ text: string; agents: string[]; sig: "high" | "medium" | "low" }>
    actions: Array<{
      text: string
      owner: string
      urgency: "today" | "this_week" | "backlog"
    }>
    roadmap: Array<{
      rec: string
      evidence: string
      confidence: "high" | "medium" | "low"
    }>
    conflicts: Array<{ description: string; resolution: string; agents: string[] }>
  }
  brief: {
    breaking: Array<{ title: string; source: string; why: string }>
    today: Array<{ title: string; source: string; why: string }>
    research: Array<{ title: string; source: string; why: string }>
  }
  leads: Array<{
    company: string
    role: string
    fit: number
    pitch: string
    timing: "urgent" | "warm"
  }>
  content: {
    post: { angle: string; status: string; preview: string }
    comments: number
  }
  techRadar: Array<{ trend: string; action: string; relevance: string }>
  agents: Record<"cbs" | "cro" | "cmo" | "cto", AgentOrbStatus>
}

type BriefItem = {
  title?: string
  headline?: string
  source?: string
  relevance?: string
  summary?: string
}

type BriefDashboard = {
  breaking?: BriefItem[]
  ai_tools?: BriefItem[]
  research?: BriefItem[]
  competitors?: BriefItem[]
  funding?: BriefItem[]
}

type FeedRow = {
  id: string
  type: string
  content: {
    status?: string
    angle?: string
    body?: string
    platform?: string
    contentType?: string
    company?: string
    role?: string
    score?: number
    pitchAngle?: string
    trends?: Array<{ trend: string; action: string; relevance: string }>
    dashboard?: BriefDashboard
    markdown?: string
  } & Record<string, unknown>
  metadata?: unknown
  created_at: string
}

export type IntelligenceFeedPayload = {
  brief: FeedRow | null
  leads: FeedRow[]
  contentQueue: FeedRow[]
  radar: FeedRow | null
  pipelineStatus: Record<string, string | null>
  staffMeeting: FeedRow | null
  commentDraftCount: number
}

function formatOwner(owner: string): string {
  const o = owner.toLowerCase()
  if (o === "founder") return "Founder"
  return o.toUpperCase()
}

function formatAgentTags(agents: string[]): string[] {
  return (agents ?? []).map(formatOwner)
}

function briefItemToCard(item: BriefItem): { title: string; source: string; why: string } {
  return {
    title: item.headline ?? item.title ?? "Untitled",
    source: item.source ?? "",
    why: item.relevance ?? item.summary ?? "",
  }
}

function parseSynthesis(content: unknown): StaffMeetingSynthesis | null {
  if (!content || typeof content !== "object") return null
  const c = content as Record<string, unknown>
  if (typeof c.executiveSummary !== "string") return null
  return content as StaffMeetingSynthesis
}

function deriveAgents(
  pipelineStatus: Record<string, string | null>,
  contentQueue: FeedRow[],
): Record<"cbs" | "cro" | "cmo" | "cto", AgentOrbStatus> {
  const linkedinPost =
    contentQueue.find(
      (r) => r.type === "content_linkedin" && r.content?.contentType === "post",
    ) ?? contentQueue.find((r) => r.type === "content_linkedin")

  const cmoStatus = linkedinPost?.content?.status
  const cmo: AgentOrbStatus =
    cmoStatus === "pending_approval"
      ? "pending_approval"
      : pipelineStatus.cmo
        ? "completed"
        : "idle"

  return {
    cbs: pipelineStatus.cbs ? "completed" : "idle",
    cro: pipelineStatus.cro ? "completed" : "idle",
    cmo,
    cto: pipelineStatus.cto ? "completed" : "idle",
  }
}

const EMPTY_SUMMARY =
  "No staff meeting synthesis yet. After CBS, CRO, CMO, and CTO publish outputs in a 24-hour window, the daily staff meeting (08:30 UTC) connects the dots here."

/** Maps `/api/intelligence/feed` (+ staff meeting row) into the Command Center panel model. */
export function buildCollaborationViewModel(payload: IntelligenceFeedPayload): CollaborationViewModel {
  const synthesis = parseSynthesis(payload.staffMeeting?.content ?? null)
  const createdAt = payload.staffMeeting?.created_at ?? new Date().toISOString()

  const dateLabel = new Date(createdAt).toLocaleDateString("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const staffMeetingBlock: CollaborationViewModel["staffMeeting"] = synthesis
    ? {
        summary: synthesis.executiveSummary || EMPTY_SUMMARY,
        insights: (synthesis.insights ?? []).map((i) => ({
          text: i.insight,
          agents: formatAgentTags(i.agents ?? []),
          sig: i.significance,
        })),
        actions: (synthesis.actions ?? []).map((a) => ({
          text: a.action,
          owner: formatOwner(a.owner),
          urgency: a.urgency,
        })),
        roadmap: (synthesis.roadmapRecommendations ?? []).map((r) => ({
          rec: r.recommendation,
          evidence: r.evidence,
          confidence: r.confidence,
        })),
        conflicts: (synthesis.conflicts ?? []).map((c) => ({
          description: c.description,
          resolution: c.resolution,
          agents: formatAgentTags(c.agents ?? []),
        })),
      }
    : {
        summary: EMPTY_SUMMARY,
        insights: [],
        actions: [],
        roadmap: [],
        conflicts: [],
      }

  const dash = payload.brief?.content?.dashboard
  const breaking = (dash?.breaking ?? []).map(briefItemToCard)
  const today = [
    ...(dash?.ai_tools ?? []).map(briefItemToCard),
    ...(dash?.funding ?? []).map(briefItemToCard),
    ...(dash?.competitors ?? []).map(briefItemToCard),
  ].slice(0, 12)
  const research = (dash?.research ?? []).map(briefItemToCard)

  const leads: CollaborationViewModel["leads"] = (payload.leads ?? []).map((row) => {
    const c = row.content ?? {}
    const score = typeof c.score === "number" ? c.score : 0
    return {
      company: typeof c.company === "string" ? c.company : "—",
      role: typeof c.role === "string" ? c.role : "—",
      fit: score,
      pitch: typeof c.pitchAngle === "string" ? c.pitchAngle : "",
      timing: score >= 8 ? "urgent" : "warm",
    }
  })

  const linkedinPost =
    payload.contentQueue.find(
      (r) => r.type === "content_linkedin" && r.content?.contentType === "post",
    ) ?? payload.contentQueue.find((r) => r.type === "content_linkedin")

  const body = typeof linkedinPost?.content?.body === "string" ? linkedinPost.content.body : ""
  const angleRaw = linkedinPost?.content?.angle
  const angle =
    typeof angleRaw === "string" && angleRaw.trim()
      ? angleRaw
      : body
        ? body.split("\n").find((l) => l.trim().length > 0)?.slice(0, 120) ?? "LinkedIn draft"
        : "No draft yet"

  const preview = body.trim() ? body.trim().slice(0, 280) : ""

  const radarContent = payload.radar?.content
  const trends =
    radarContent && typeof radarContent === "object" && Array.isArray(radarContent.trends)
      ? radarContent.trends
      : []

  return {
    dateLabel,
    meetingTimeLabel: "8:30am UTC",
    staffMeeting: staffMeetingBlock,
    brief: { breaking, today, research },
    leads,
    content: {
      post: {
        angle,
        status: linkedinPost?.content?.status ?? "—",
        preview,
      },
      comments: payload.commentDraftCount ?? 0,
    },
    techRadar: trends,
    agents: deriveAgents(payload.pipelineStatus ?? {}, payload.contentQueue ?? []),
  }
}

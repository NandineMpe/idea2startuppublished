/** Shared shape for daily staff meeting JSON (Inngest synthesis + `ai_outputs` row `content`). */

export type StaffMeetingSynthesis = {
  insights: Array<{
    insight: string
    agents: string[]
    significance: "high" | "medium" | "low"
  }>
  actions: Array<{
    action: string
    owner: "founder" | "cbs" | "cro" | "cmo" | "cto"
    urgency: "today" | "this_week" | "backlog"
    rationale: string
  }>
  roadmapRecommendations: Array<{
    recommendation: string
    evidence: string
    confidence: "high" | "medium" | "low"
  }>
  conflicts: Array<{
    description: string
    agents: string[]
    resolution: string
  }>
  executiveSummary: string
}

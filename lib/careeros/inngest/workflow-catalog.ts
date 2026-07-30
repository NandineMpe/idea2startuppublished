import type { CareerOSEvents } from "@/lib/careeros/inngest/client"

export type CareerOSWorkflowKey = keyof CareerOSEvents | CareerOSWorkflowPreset

/** Named bundles for one-click ops (expanded in trigger-workflows). */
export type CareerOSWorkflowPreset =
  | "preset:ingest-full"
  | "preset:market-refresh"
  | "preset:user-career-refresh"
  | "preset:profile-extract"

export type WorkflowScope = "global" | "user"

export type WorkflowDefinition = {
  key: CareerOSWorkflowKey
  event: keyof CareerOSEvents
  scope: WorkflowScope
  label: string
  description: string
  adminOnly?: boolean
}

export const CAREEROS_WORKFLOWS: WorkflowDefinition[] = [
  {
    key: "careeros/system.ping",
    event: "careeros/system.ping",
    scope: "global",
    label: "System ping",
    description: "Health check that Inngest and CareerOS workers are wired.",
    adminOnly: true,
  },
  {
    key: "careeros/feed.ingest",
    event: "careeros/feed.ingest",
    scope: "global",
    label: "Feed ingest",
    description: "Fetch all RSS sources, persist items, fan out enrich + personalise.",
    adminOnly: true,
  },
  {
    key: "careeros/cache.refresh",
    event: "careeros/cache.refresh",
    scope: "global",
    label: "O*NET cache refresh",
    description: "Warm occupation cache from keyword probes.",
    adminOnly: true,
  },
  {
    key: "careeros/market.refresh-demand",
    event: "careeros/market.refresh-demand",
    scope: "global",
    label: "Market demand refresh",
    description: "Refresh demand trajectory cache.",
    adminOnly: true,
  },
  {
    key: "careeros/market.refresh-salary",
    event: "careeros/market.refresh-salary",
    scope: "global",
    label: "Market salary refresh",
    description: "Refresh salary band cache.",
    adminOnly: true,
  },
  {
    key: "careeros/market.refresh-skill-velocity",
    event: "careeros/market.refresh-skill-velocity",
    scope: "global",
    label: "Skill velocity refresh",
    description: "Recompute market skill velocity from postings.",
    adminOnly: true,
  },
  {
    key: "careeros/market.refresh-adjacent-roles",
    event: "careeros/market.refresh-adjacent-roles",
    scope: "global",
    label: "Adjacent roles refresh",
    description: "Rebuild adjacent role recommendations cache.",
    adminOnly: true,
  },
  {
    key: "careeros/market.refresh-frontier-roles",
    event: "careeros/market.refresh-frontier-roles",
    scope: "global",
    label: "Frontier roles refresh",
    description: "Refresh frontier role snapshots (TheirStack).",
    adminOnly: true,
  },
  {
    key: "careeros/skills.refresh-exposure-scores",
    event: "careeros/skills.refresh-exposure-scores",
    scope: "global",
    label: "Exposure scores refresh",
    description: "Infer AI exposure scores for unscored skills.",
    adminOnly: true,
  },
  {
    key: "careeros/career-health.daily-scheduler",
    event: "careeros/career-health.daily-scheduler",
    scope: "global",
    label: "Health report scheduler",
    description: "Fan out career health reports for eligible users.",
    adminOnly: true,
  },
  {
    key: "careeros/feed.enrich-item",
    event: "careeros/feed.enrich-item",
    scope: "global",
    label: "Enrich feed item",
    description: "Enrich one source item by ID (pass source_item_id in data).",
    adminOnly: true,
  },
  {
    key: "careeros/feed.personalise-for-all-users",
    event: "careeros/feed.personalise-for-all-users",
    scope: "global",
    label: "Personalise item (all users)",
    description: "Fan out personalisation for one enriched item (pass enriched_item_id).",
    adminOnly: true,
  },
  {
    key: "careeros/feed.personalise-for-user",
    event: "careeros/feed.personalise-for-user",
    scope: "user",
    label: "Personalise one item for me",
    description: "Personalise a single enriched item for your account (pass enriched_item_id).",
    adminOnly: true,
  },
  {
    key: "careeros/feed.personalise-pending-for-user",
    event: "careeros/feed.personalise-pending-for-user",
    scope: "user",
    label: "Personalise my feed",
    description: "Queue personalisation for recent enriched items missing from your feed.",
  },
  {
    key: "careeros/profile.extract",
    event: "careeros/profile.extract",
    scope: "user",
    label: "Re-run profile extract",
    description: "Re-parse your uploaded CV/LinkedIn and refresh skills (same as Workspace extract).",
  },
  {
    key: "careeros/profile.onet-map",
    event: "careeros/profile.onet-map",
    scope: "user",
    label: "O*NET map profile",
    description: "Re-run occupation + skill O*NET mapping for your profile.",
  },
  {
    key: "careeros/skills.embed",
    event: "careeros/skills.embed",
    scope: "user",
    label: "Embed skills",
    description: "Refresh skill embeddings for matching.",
  },
  {
    key: "careeros/skills.compute-half-life-for-user",
    event: "careeros/skills.compute-half-life-for-user",
    scope: "user",
    label: "Compute skill half-life",
    description: "Recompute half-life estimates for your skills.",
  },
  {
    key: "careeros/career-health.generate-for-user",
    event: "careeros/career-health.generate-for-user",
    scope: "user",
    label: "Generate health report",
    description: "Queue a career health report for your account.",
  },
]

export const WORKFLOW_PRESETS: Record<
  CareerOSWorkflowPreset,
  { label: string; description: string; events: Array<keyof CareerOSEvents> }
> = {
  "preset:ingest-full": {
    label: "Full feed ingest",
    description: "Ingest all sources (enrich + personalise fan-out automatically).",
    events: ["careeros/feed.ingest"],
  },
  "preset:market-refresh": {
    label: "Market data refresh",
    description: "O*NET cache, demand, salary, velocity, adjacent + frontier roles, exposure scores.",
    events: [
      "careeros/cache.refresh",
      "careeros/market.refresh-demand",
      "careeros/market.refresh-salary",
      "careeros/market.refresh-skill-velocity",
      "careeros/market.refresh-adjacent-roles",
      "careeros/market.refresh-frontier-roles",
      "careeros/skills.refresh-exposure-scores",
    ],
  },
  "preset:user-career-refresh": {
    label: "Refresh my career data",
    description: "O*NET map, skill embeds, pending feed personalisation, half-life.",
    events: [
      "careeros/profile.onet-map",
      "careeros/skills.embed",
      "careeros/feed.personalise-pending-for-user",
      "careeros/skills.compute-half-life-for-user",
    ],
  },
  "preset:profile-extract": {
    label: "Re-extract profile",
    description: "Re-run CV/LinkedIn extraction and downstream skill mapping.",
    events: ["careeros/profile.extract"],
  },
}

export function isWorkflowPreset(key: string): key is CareerOSWorkflowPreset {
  return key in WORKFLOW_PRESETS
}

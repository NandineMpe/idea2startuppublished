import {
  sendCareerOSEvent,
  type CareerOSEvents,
} from "@/lib/careeros/inngest/client"
import {
  CAREEROS_WORKFLOWS,
  isWorkflowPreset,
  WORKFLOW_PRESETS,
  type CareerOSWorkflowKey,
  type CareerOSWorkflowPreset,
} from "@/lib/careeros/inngest/workflow-catalog"

export type TriggerWorkflowOptions = {
  workflow: CareerOSWorkflowKey
  userId?: string
  data?: Record<string, unknown>
  admin?: boolean
}

export type TriggerResult = {
  queued: Array<{ name: keyof CareerOSEvents; data: CareerOSEvents[keyof CareerOSEvents]["data"] }>
}

function resolveEvents(workflow: CareerOSWorkflowKey): Array<keyof CareerOSEvents> {
  if (isWorkflowPreset(workflow)) {
    return WORKFLOW_PRESETS[workflow as CareerOSWorkflowPreset].events
  }
  if (workflow.startsWith("careeros/")) {
    return [workflow as keyof CareerOSEvents]
  }
  throw new Error(`Unknown workflow: ${workflow}`)
}

function buildEventData(
  eventName: keyof CareerOSEvents,
  userId: string | undefined,
  data: Record<string, unknown> | undefined,
): CareerOSEvents[keyof CareerOSEvents]["data"] {
  switch (eventName) {
    case "careeros/feed.ingest":
      return {
        hours_back: typeof data?.hours_back === "number" ? data.hours_back : undefined,
      }
    case "careeros/cache.refresh":
      return {
        onetKeywords: Array.isArray(data?.onetKeywords)
          ? (data.onetKeywords as string[])
          : undefined,
      }
    case "careeros/market.refresh-demand":
    case "careeros/market.refresh-salary":
      return {
        soc_codes: Array.isArray(data?.soc_codes) ? (data.soc_codes as string[]) : undefined,
        region_codes: Array.isArray(data?.region_codes)
          ? (data.region_codes as string[])
          : undefined,
        offset: typeof data?.offset === "number" ? data.offset : undefined,
        max_combos: typeof data?.max_combos === "number" ? data.max_combos : undefined,
      }
    case "careeros/market.refresh-skill-velocity":
      return {
        region_codes: Array.isArray(data?.region_codes)
          ? (data.region_codes as string[])
          : undefined,
        window_codes: Array.isArray(data?.window_codes)
          ? (data.window_codes as string[])
          : undefined,
      }
    case "careeros/market.refresh-adjacent-roles":
      return {
        source_soc_codes: Array.isArray(data?.source_soc_codes)
          ? (data.source_soc_codes as string[])
          : undefined,
        top_k: typeof data?.top_k === "number" ? data.top_k : undefined,
      }
    case "careeros/market.refresh-frontier-roles":
    case "careeros/skills.refresh-exposure-scores":
    case "careeros/career-health.daily-scheduler":
      return {}
    case "careeros/feed.personalise-pending-for-user":
    case "careeros/profile.onet-map":
    case "careeros/skills.embed":
    case "careeros/skills.compute-half-life-for-user":
    case "careeros/career-health.generate-for-user":
      if (!userId) throw new Error(`${eventName} requires userId`)
      if (eventName === "careeros/feed.personalise-pending-for-user") {
        return {
          user_id: userId,
          days_back: typeof data?.days_back === "number" ? data.days_back : 14,
          limit: typeof data?.limit === "number" ? data.limit : 25,
        }
      }
      return { user_id: userId }
    case "careeros/feed.enrich-item":
      if (!data?.source_item_id || typeof data.source_item_id !== "string") {
        throw new Error("careeros/feed.enrich-item requires source_item_id")
      }
      return { source_item_id: data.source_item_id }
    case "careeros/feed.personalise-for-all-users":
      if (!data?.enriched_item_id || typeof data.enriched_item_id !== "string") {
        throw new Error("careeros/feed.personalise-for-all-users requires enriched_item_id")
      }
      return { enriched_item_id: data.enriched_item_id }
    case "careeros/feed.personalise-for-user":
      if (!userId) throw new Error("careeros/feed.personalise-for-user requires userId")
      if (!data?.enriched_item_id || typeof data.enriched_item_id !== "string") {
        throw new Error("careeros/feed.personalise-for-user requires enriched_item_id")
      }
      return { user_id: userId, enriched_item_id: data.enriched_item_id }
    case "careeros/profile.extract":
      if (!userId) throw new Error("careeros/profile.extract requires userId")
      if (!data?.onboarding_completion_id || typeof data.onboarding_completion_id !== "string") {
        throw new Error("careeros/profile.extract requires onboarding_completion_id")
      }
      return {
        user_id: userId,
        onboarding_completion_id: data.onboarding_completion_id,
      }
    case "careeros/system.ping":
      return {
        source: typeof data?.source === "string" ? data.source : "api",
        timestamp: new Date().toISOString(),
      }
    default:
      return {} as CareerOSEvents[keyof CareerOSEvents]["data"]
  }
}

export function assertWorkflowAllowed(
  workflow: CareerOSWorkflowKey,
  admin: boolean,
): void {
  if (isWorkflowPreset(workflow)) {
    const preset = WORKFLOW_PRESETS[workflow]
    for (const ev of preset.events) {
      const def = CAREEROS_WORKFLOWS.find((w) => w.event === ev)
      if (def?.adminOnly && !admin) {
        throw new Error(`Workflow preset requires admin: ${ev}`)
      }
    }
    return
  }
  const def = CAREEROS_WORKFLOWS.find((w) => w.key === workflow)
  if (!def) throw new Error(`Unknown workflow: ${workflow}`)
  if (def.adminOnly && !admin) {
    throw new Error(`Workflow requires admin: ${workflow}`)
  }
}

export async function triggerCareerOSWorkflows(
  options: TriggerWorkflowOptions,
): Promise<TriggerResult> {
  const { workflow, userId, data, admin = false } = options
  assertWorkflowAllowed(workflow, admin)

  const events = resolveEvents(workflow)
  const queued: TriggerResult["queued"] = []

  for (const eventName of events) {
    const payload = {
      name: eventName,
      data: buildEventData(eventName, userId, data),
    } as TriggerResult["queued"][number]
    await sendCareerOSEvent(payload)
    queued.push(payload)
  }

  return { queued }
}

export function listWorkflowsForCaller(admin: boolean) {
  const singles = CAREEROS_WORKFLOWS.filter((w) => !w.adminOnly || admin).map((w) => ({
    key: w.key,
    scope: w.scope,
    label: w.label,
    description: w.description,
  }))
  const presets = Object.entries(WORKFLOW_PRESETS)
    .filter(([key]) => {
      try {
        assertWorkflowAllowed(key as CareerOSWorkflowPreset, admin)
        return true
      } catch {
        return false
      }
    })
    .map(([key, p]) => ({
      key,
      scope: "preset" as const,
      label: p.label,
      description: p.description,
    }))
  return [...presets, ...singles]
}

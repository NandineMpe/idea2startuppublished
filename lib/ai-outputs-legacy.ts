import type { StaffMeetingSynthesis } from "@/lib/staff-meeting-types"

/** Row shape returned from Supabase for `ai_outputs` (current schema). */
export type AiOutputDbRow = {
  id: string
  tool: string | null
  title?: string | null
  inputs: Record<string, unknown> | null
  output: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

/**
 * Legacy feed shape: what `/api/intelligence/feed` and staff-meeting collaboration
 * expect (`type` + nested `content`), built from `tool` + `inputs` + `output` + `metadata`.
 */
export type LegacyAiFeedRow = {
  id: string
  type: string
  content: {
    status?: string
    angle?: string
    body?: string
    platform?: string
    contentType?: string
    company?: unknown
    role?: unknown
    url?: unknown
    score?: unknown
    pitchAngle?: unknown
    trends?: unknown
    dashboard?: unknown
    markdown?: string
    whatsapp?: string
    postSuggestions?: unknown
    sourcesScanned?: unknown
  } & Record<string, unknown>
  metadata?: unknown
  created_at: string
}

function tryParseJsonObject(s: string): Record<string, unknown> | null {
  try {
    const o = JSON.parse(s) as unknown
    if (o && typeof o === "object" && !Array.isArray(o)) return o as Record<string, unknown>
  } catch {
    /* ignore */
  }
  return null
}

function synthesisFromOutput(output: string | null): StaffMeetingSynthesis | null {
  if (!output?.trim()) return null
  const parsed = tryParseJsonObject(output) as StaffMeetingSynthesis | null
  if (parsed && typeof parsed.executiveSummary === "string") return parsed
  return null
}

export function toLegacyFeedRow(row: AiOutputDbRow): LegacyAiFeedRow {
  const tool = row.tool ?? ""
  const inputs = (row.inputs ?? {}) as Record<string, unknown>
  const meta = (row.metadata ?? {}) as Record<string, unknown>

  if (tool === "daily_brief") {
    return {
      id: row.id,
      type: "daily_brief",
      content: {
        markdown: row.output ?? "",
        dashboard: meta.dashboard,
        whatsapp: typeof meta.whatsapp === "string" ? meta.whatsapp : undefined,
      },
      metadata: row.metadata,
      created_at: row.created_at,
    }
  }

  if (tool === "lead_discovered") {
    return {
      id: row.id,
      type: "lead_discovered",
      content: {
        company: inputs.company,
        role: inputs.role,
        url: inputs.url,
        score: inputs.score,
        pitchAngle: inputs.pitchAngle,
        timing: inputs.timing,
        jobLocation: inputs.jobLocation,
        jobSalary: inputs.jobSalary,
        linkedinConnect: inputs.linkedinConnect,
        linkedinDM: inputs.linkedinDM,
        email: inputs.email,
        body: row.output ?? "",
      },
      metadata: row.metadata,
      created_at: row.created_at,
    }
  }

  if (tool === "content_linkedin" || tool === "content_technical") {
    return {
      id: row.id,
      type: tool,
      content: {
        platform: inputs.platform,
        contentType: inputs.contentType,
        status: inputs.status,
        angle: inputs.angle,
        body: row.output ?? "",
      },
      metadata: row.metadata,
      created_at: row.created_at,
    }
  }

  if (tool === "tech_radar") {
    return {
      id: row.id,
      type: "tech_radar",
      content: {
        trends: inputs.trends,
        postSuggestions: inputs.postSuggestions,
        sourcesScanned: inputs.sourcesScanned,
        markdownSummary: row.output ?? "",
      },
      metadata: row.metadata,
      created_at: row.created_at,
    }
  }

  if (tool === "staff_meeting") {
    const syn =
      (inputs.synthesis as StaffMeetingSynthesis | undefined) ?? synthesisFromOutput(row.output)
    return {
      id: row.id,
      type: "staff_meeting",
      content: syn ?? { executiveSummary: row.output ?? "" },
      metadata: row.metadata,
      created_at: row.created_at,
    }
  }

  if (tool === "onboarding_extraction") {
    const extracted = inputs.extracted
    return {
      id: row.id,
      type: "onboarding_extraction",
      content: (extracted && typeof extracted === "object"
        ? (extracted as Record<string, unknown>)
        : inputs) as LegacyAiFeedRow["content"],
      metadata: row.metadata,
      created_at: row.created_at,
    }
  }

  if (tool === "relationship_interaction") {
    return {
      id: row.id,
      type: "relationship_interaction",
      content: inputs as LegacyAiFeedRow["content"],
      metadata: row.metadata,
      created_at: row.created_at,
    }
  }

  return {
    id: row.id,
    type: tool || "unknown",
    content: inputs as LegacyAiFeedRow["content"],
    metadata: row.metadata,
    created_at: row.created_at,
  }
}

import { createClient } from "@supabase/supabase-js"
import type { ScoredItem } from "@/lib/juno/types"

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(url, key)
}

// ─── Persist brief to Supabase ───────────────────────────────────

export async function saveBriefToDB(params: {
  userId: string
  brief: unknown
  rawItemCount: number
  scoredItemCount: number
  briefDateIso?: string
  scoredItems: ScoredItem[]
}): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn("[juno/delivery] saveBriefToDB: missing Supabase env — skipping")
    return
  }

  try {
    const supabase = getServiceClient()
    const contentPayload =
      typeof params.brief === "object" && params.brief !== null
        ? (params.brief as Record<string, unknown>)
        : { markdown: String(params.brief) }

    const markdown =
      typeof contentPayload.markdown === "string"
        ? contentPayload.markdown
        : String(contentPayload.markdown ?? "")

    const dateStr = params.briefDateIso ?? new Date().toISOString().slice(0, 10)
    const title = `Daily Brief — ${dateStr}`

    const { error } = await supabase.from("ai_outputs").insert({
      user_id: params.userId,
      tool: "daily_brief",
      title,
      output: markdown,
      inputs: {
        raw_item_count: params.rawItemCount,
        scored_item_count: params.scoredItemCount,
        scored_items: params.scoredItems,
      },
      metadata: {
        generated_at: new Date().toISOString(),
        brief_date_iso: dateStr,
        dashboard: contentPayload.dashboard,
      },
    })

    if (error) console.error("[juno/delivery] Failed to save brief:", error.message)
  } catch (e) {
    console.error("[juno/delivery] saveBriefToDB:", e instanceof Error ? e.message : e)
  }
}

// ─── Persist leads to Supabase ───────────────────────────────────

export type SaveLeadInput = {
  userId: string
  company: string
  role: string
  /** Contact / prospect name when known (optional; shown in lookalike list). */
  contactName?: string
  url?: string
  /** Best-known email domain for TheOrg / enrichment (e.g. acme.com). */
  companyDomain?: string | null
  score: number
  pitchAngle: string
  source: string
  timing?: "urgent" | "warm" | "cold"
  budgetSignal?: "high" | "medium" | "low"
  jobLocation?: string
  jobSalary?: string
  linkedinConnect?: string
  linkedinDM?: string
  email?: string
}

/** Persists to `cro_leads` + `ai_outputs`. Returns `cro_leads.id` when the row is created. */
export async function saveLeadToDB(params: SaveLeadInput): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn("[juno/delivery] saveLeadToDB: missing Supabase env — skipping")
    return null
  }

  try {
    const supabase = getServiceClient()

    let croLeadId: string | null = null
    const { data: croRow, error: croError } = await supabase
      .from("cro_leads")
      .insert({
        user_id: params.userId,
        company: params.company,
        role: params.role,
        url: params.url ?? null,
        icp_fit: params.score,
        pitch_angle: params.pitchAngle,
        source: params.source,
        company_domain: params.companyDomain ?? null,
      })
      .select("id")
      .single()

    if (croError) {
      console.error("[juno/delivery] cro_leads insert:", croError.message)
    } else {
      croLeadId = croRow?.id ?? null
    }

    const title = `Lead: ${params.company} — ${params.role}`.slice(0, 500)
    const outreachMd = [
      params.linkedinConnect
        ? `### LinkedIn connection request\n${params.linkedinConnect}`
        : "",
      params.linkedinDM ? `### LinkedIn DM\n${params.linkedinDM}` : "",
      params.email ? `### Cold email\n${params.email}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")

    const output = [
      `Score: ${params.score}/10`,
      params.timing ? `Timing: ${params.timing}` : "",
      params.budgetSignal ? `Budget signal: ${params.budgetSignal}` : "",
      `Source: ${params.source}`,
      params.jobLocation ? `Location: ${params.jobLocation}` : "",
      params.jobSalary ? `Salary: ${params.jobSalary}` : "",
      params.url ? `URL: ${params.url}` : "",
      "",
      params.pitchAngle,
      outreachMd ? `\n---\n${outreachMd}` : "",
    ]
      .filter((line) => line !== "")
      .join("\n")

    const { error } = await supabase.from("ai_outputs").insert({
      user_id: params.userId,
      tool: "lead_discovered",
      title,
      output,
      inputs: {
        company: params.company,
        role: params.role,
        contactName: params.contactName?.trim() || undefined,
        url: params.url ?? "",
        score: params.score,
        pitchAngle: params.pitchAngle,
        source: params.source,
        timing: params.timing,
        budgetSignal: params.budgetSignal,
        jobLocation: params.jobLocation,
        jobSalary: params.jobSalary,
        linkedinConnect: params.linkedinConnect,
        linkedinDM: params.linkedinDM,
        email: params.email,
        cro_lead_id: croLeadId,
      },
      metadata: {
        discovered_at: new Date().toISOString(),
        cro_lead_id: croLeadId,
      },
    })

    if (error) console.error("[juno/delivery] Failed to save lead:", error.message)
    return croLeadId
  } catch (e) {
    console.error("[juno/delivery] saveLeadToDB:", e instanceof Error ? e.message : e)
    return null
  }
}

// ─── Persist content to Supabase ─────────────────────────────────

export type SaveContentInput = {
  userId: string
  platform: string
  contentType: string
  body: string
  status: "draft" | "pending_approval" | "approved" | "published"
}

export async function saveContentToDB(params: SaveContentInput): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn("[juno/delivery] saveContentToDB: missing Supabase env — skipping")
    return null
  }

  try {
    const supabase = getServiceClient()
    const tool = `content_${params.platform}`
    const title = `${params.contentType} — ${params.platform}`.slice(0, 500)
    const { data, error } = await supabase
      .from("ai_outputs")
      .insert({
        user_id: params.userId,
        tool,
        title,
        output: params.body,
        inputs: {
          platform: params.platform,
          contentType: params.contentType,
          status: params.status,
        },
        metadata: { created_at: new Date().toISOString() },
      })
      .select("id")
      .single()

    if (error) {
      console.error("[juno/delivery] Failed to save content:", error.message)
      return null
    }
    return data?.id ?? null
  } catch (e) {
    console.error("[juno/delivery] saveContentToDB:", e instanceof Error ? e.message : e)
    return null
  }
}

import { supabaseAdmin } from "@/lib/supabase"

export type ContentCalendarSource =
  | "cmo_agent"
  | "cto_radar"
  | "cro_outreach"
  | "manual"
  | "brief"

export type ContentCalendarInsert = {
  userId: string
  title: string | null
  body: string
  channel: string
  contentType: string
  scheduledDate?: string | null
  scheduledTime?: string | null
  status?: "draft" | "approved" | "posted" | "skipped"
  source: ContentCalendarSource
  sourceRef?: string | null
  angle?: string | null
  targetAudience?: string | null
  notes?: string | null
}

/** Insert from Inngest (service role). Returns new row id or null. */
export async function insertContentCalendarRow(params: ContentCalendarInsert): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn("[content-calendar] insert skipped: missing Supabase env")
    return null
  }

  const { data, error } = await supabaseAdmin
    .from("content_calendar")
    .insert({
      user_id: params.userId,
      title: params.title,
      body: params.body,
      channel: params.channel,
      content_type: params.contentType,
      scheduled_date: params.scheduledDate ?? null,
      scheduled_time: params.scheduledTime ?? null,
      status: params.status ?? "draft",
      source: params.source,
      source_ref: params.sourceRef ?? null,
      angle: params.angle ?? null,
      target_audience: params.targetAudience ?? null,
      notes: params.notes ?? null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[content-calendar] insert:", error.message)
    return null
  }
  return data?.id ?? null
}

"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { sendCareerOSEvent } from "@/lib/careeros/inngest/client"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function queueCareerHealthReport(): Promise<void> {
  if (!process.env.INNGEST_EVENT_KEY?.trim()) {
    redirect("/careeros/health-report?status=no_inngest")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent, error: rErr } = await supabaseAdmin
    .schema("careeros")
    .from("user_career_health_reports")
    .select("id")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .maybeSingle()

  if (rErr) {
    redirect(`/careeros/health-report?status=error&message=${encodeURIComponent(rErr.message)}`)
  }
  if (recent?.id) {
    redirect("/careeros/health-report?status=too_soon")
  }

  await sendCareerOSEvent({
    name: "careeros/career-health.generate-for-user",
    data: { user_id: user.id },
  })

  revalidatePath("/careeros/health-report")
  redirect("/careeros/health-report?status=queued")
}

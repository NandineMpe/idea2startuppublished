import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest } from "../client"
import {
  isDueForNextReport,
  isPastFirstReportEligibleWindow,
  parseModule12CompletedAt,
} from "@/lib/careeros/career-health/schedule-eligibility"

export const careerHealthDailyScheduler = careerosInngest.createFunction(
  {
    id: "careeros-career-health-daily-scheduler",
    name: "CareerOS career-health.daily-scheduler",
    retries: 1,
    triggers: [{ cron: "25 14 * * *" }, { event: "careeros/career-health.daily-scheduler" }],
  },
  async ({ step }) => {
    const dueUserIds = await step.run("scan-eligible-users", async () => {
      const { data: rows, error } = await supabaseAdmin
        .schema("careeros")
        .from("user_settings")
        .select("user_id,onboarding_state")

      if (error) throw error

      const now = Date.now()
      const out: string[] = []

      for (const row of rows ?? []) {
        const uid = String(row.user_id ?? "")
        if (!uid) continue
        const completedAt = parseModule12CompletedAt(row.onboarding_state)
        if (!completedAt) continue
        if (!isPastFirstReportEligibleWindow(completedAt, now)) continue

        const { data: last, error: le } = await supabaseAdmin
          .schema("careeros")
          .from("user_career_health_reports")
          .select("created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (le) throw le
        const lastIso = (last?.created_at as string | undefined) ?? null
        if (!isDueForNextReport(lastIso, now)) continue
        out.push(uid)
      }

      return out
    })

    if (!dueUserIds.length) {
      return { fanned_out: 0 }
    }

    await step.run("fan-out-generate", async () => {
      await careerosInngest.send(
        dueUserIds.map((user_id) => ({
          name: "careeros/career-health.generate-for-user" as const,
          data: { user_id },
        })),
      )
    })

    return { fanned_out: dueUserIds.length }
  },
)

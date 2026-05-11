import { randomUUID } from "crypto"
import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest } from "../client"
import { qwenGenerateObject, QWEN_MODEL_NAME, QWEN_MODEL_VERSION } from "@/lib/careeros/ai/qwen"
import {
  CAREER_HEALTH_PROMPT_VERSION,
  CAREER_HEALTH_SYSTEM_PROMPT,
  buildCareerHealthUserPrompt,
} from "@/lib/careeros/prompts/career-health-report.v1"
import { careerHealthInputDataVersion, gatherCareerHealthInputs } from "@/lib/careeros/career-health/gather-inputs"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import type { CareerHealthNarrative } from "@/lib/careeros/career-health/narrative-schema"
import { careerHealthNarrativeSchema } from "@/lib/careeros/career-health/narrative-schema"
import { normalizeCareerHealthNarrativeHrefs } from "@/lib/careeros/career-health/action-hrefs"

const SCHEMA_VERSION = "1"

function fallbackNarrative(args: { period_label: string; composite: number }): CareerHealthNarrative {
  return normalizeCareerHealthNarrativeHrefs({
    headline: `Your ${args.period_label} Career Health score is ${args.composite}`,
    subhead: "We hit a temporary model error, so this is a short auto summary.",
    opening:
      "Scores below are from your live profile, skills, and market caches. Open each section on the report page once generation is back to full prose.",
    closing: "Check your skills portfolio and market briefing, then rerun this report from support if it stays stubbed.",
    recommended_actions: [
      {
        title: "Refresh your market briefing",
        detail: "Open Market and let demand caches populate for your region.",
        related_pillar: "market_demand",
        priority: 1,
        career_os_href: "/careeros/market",
      },
      {
        title: "Confirm salary and seniority",
        detail: "Add current salary and years in role so compensation positioning is not neutral.",
        related_pillar: "compensation_positioning",
        priority: 2,
        career_os_href: "/careeros/market",
      },
      {
        title: "Review at-risk skills",
        detail: "Sort skills by status and plan one upskill or redeploy move this month.",
        related_pillar: "skill_currency",
        priority: 3,
        career_os_href: "/careeros/skills",
      },
    ],
  })
}

export const careerHealthGenerateForUser = careerosInngest.createFunction(
  {
    id: "careeros-career-health-generate-for-user",
    name: "CareerOS career-health.generate-for-user",
    retries: 1,
    concurrency: { limit: 4, key: "event.data.user_id" },
    triggers: [{ event: "careeros/career-health.generate-for-user" }],
  },
  async ({ step, event }) => {
    const userId = String(event.data.user_id ?? "")
    if (!userId) {
      return { ok: false, error: "missing_user_id" }
    }

    const recentDup = await step.run("dedupe-recent-run", async () => {
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabaseAdmin
        .schema("careeros")
        .from("user_career_health_reports")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", since)
        .maybeSingle()
      if (error) throw error
      return data?.id ? String(data.id) : null
    })
    if (recentDup) {
      return { ok: true, skipped: true, report_id: recentDup, reason: "recent_report_exists" }
    }

    const inputs = await step.run("gather-inputs", async () => gatherCareerHealthInputs(userId))

    const structuredForHash = {
      period: inputs.period_label,
      pillars: inputs.pillar_scores,
      composite: inputs.composite_score_0_100,
      profile: inputs.profile,
      skills_n: inputs.skills.length,
    }
    const idv = careerHealthInputDataVersion(structuredForHash)

    const narrative = await step.run("generate-narrative", async () => {
      const json = JSON.stringify(
        {
          period_label: inputs.period_label,
          pillar_scores: inputs.pillar_scores,
          composite_score_0_100: inputs.composite_score_0_100,
          profile: inputs.profile,
          skills: inputs.skills.slice(0, 40),
          demand: inputs.demand,
          salary: inputs.salary,
          layoff: inputs.layoff,
        },
        null,
        0,
      )
      try {
        const { object } = await qwenGenerateObject({
          schema: careerHealthNarrativeSchema,
          systemPrompt: mergeSystemWithWritingRules(CAREER_HEALTH_SYSTEM_PROMPT),
          userPrompt: buildCareerHealthUserPrompt(json),
        })
        const sorted = [...object.recommended_actions].sort((a, b) => a.priority - b.priority)
        return normalizeCareerHealthNarrativeHrefs({ ...object, recommended_actions: sorted })
      } catch {
        return fallbackNarrative({
          period_label: inputs.period_label,
          composite: inputs.composite_score_0_100,
        })
      }
    })

    const reportId = await step.run("persist-report", async () => {
      const { data: prevRows, error: prevErr } = await supabaseAdmin
        .schema("careeros")
        .from("user_career_health_reports")
        .select("version")
        .eq("user_id", userId)
        .eq("report_year", inputs.report_year)
        .eq("report_quarter", inputs.report_quarter)

      if (prevErr) throw prevErr
      const maxV = Math.max(0, ...(prevRows ?? []).map((r) => Number(r.version) || 0))
      const nextVersion = maxV + 1

      const { error: bumpErr } = await supabaseAdmin
        .schema("careeros")
        .from("user_career_health_reports")
        .update({ is_current: false, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("report_year", inputs.report_year)
        .eq("report_quarter", inputs.report_quarter)
        .eq("is_current", true)

      if (bumpErr) throw bumpErr

      const id = randomUUID()
      const report_payload = {
        schema: "career_health_report_v1",
        structured_inputs: inputs,
        narrative,
      }

      const { error: insErr } = await supabaseAdmin.schema("careeros").from("user_career_health_reports").insert({
        id,
        user_id: userId,
        report_year: inputs.report_year,
        report_quarter: inputs.report_quarter,
        version: nextVersion,
        is_current: true,
        score_overall: inputs.composite_score_0_100,
        report_payload,
        model_version: QWEN_MODEL_NAME,
        prompt_version: CAREER_HEALTH_PROMPT_VERSION,
        schema_version: SCHEMA_VERSION,
        input_data_version: idv,
        source_attribution: {
          workflow: "careeros-career-health-generate-for-user",
          skills_sampled: inputs.skills.length,
        },
      })

      if (insErr) throw insErr
      return id
    })

    await step.run("notify-feed", async () => {
      const title = `Your ${inputs.period_label} Career Health Report is ready.`
      const { error } = await supabaseAdmin.schema("careeros").from("user_ai_feed_items").insert({
        user_id: userId,
        feed_type: "career_health_report",
        feed_at: new Date().toISOString(),
        title,
        item_payload: {
          report_id: reportId,
          period_label: inputs.period_label,
          composite_score: inputs.composite_score_0_100,
          href: "/careeros/health-report",
        },
        model_version: QWEN_MODEL_NAME,
        prompt_version: CAREER_HEALTH_PROMPT_VERSION,
        schema_version: SCHEMA_VERSION,
        input_data_version: idv,
        source_attribution: { report_id: reportId },
      })
      if (error) throw error
    })

    await step.run("audit-run", async () => {
      const { error } = await supabaseAdmin.schema("careeros").from("generation_runs").insert({
        id: randomUUID(),
        user_id: userId,
        artefact_table: "careeros.user_career_health_reports",
        artefact_id: reportId,
        workflow_name: "careeros/career-health.generate-for-user",
        provider: "qwen",
        model_name: QWEN_MODEL_NAME,
        model_version: QWEN_MODEL_VERSION,
        prompt_version: CAREER_HEALTH_PROMPT_VERSION,
        schema_version: SCHEMA_VERSION,
        input_data_version: idv,
        source_attribution: { report_id: reportId },
        input_hash: idv,
        output_hash: reportId,
        latency_ms: null,
        token_usage: null,
        status: "completed",
      })
      if (error) throw error
    })

    return {
      ok: true,
      user_id: userId,
      report_id: reportId,
      composite_score: inputs.composite_score_0_100,
      period_label: inputs.period_label,
    }
  },
)

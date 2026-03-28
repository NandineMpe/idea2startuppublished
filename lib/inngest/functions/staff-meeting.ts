import Anthropic from "@anthropic-ai/sdk"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import { toLegacyFeedRow, type AiOutputDbRow } from "@/lib/ai-outputs-legacy"
import { getActiveUserIds, getCompanyContext } from "@/lib/company-context"
import { loadCompetitorTrackingRecent, loadFundingTrackerRecent } from "@/lib/juno/competitor-persistence"
import type { StaffMeetingSynthesis } from "@/lib/staff-meeting-types"
import { supabaseAdmin } from "@/lib/supabase"
import { inngest } from "@/lib/inngest/client"

export type { StaffMeetingSynthesis } from "@/lib/staff-meeting-types"

const anthropic = new Anthropic()

function extractText(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("")
}

function parseSynthesisJson(text: string): StaffMeetingSynthesis {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as StaffMeetingSynthesis
      if (parsed && typeof parsed.executiveSummary === "string") return parsed
    }
  } catch {
    /* fallback below */
  }
  return {
    insights: [],
    actions: [],
    roadmapRecommendations: [],
    conflicts: [],
    executiveSummary: text,
  }
}

function organiseByRole(
  rows: Array<{ type: string; content: unknown; metadata: unknown; created_at: string }>,
): Record<string, typeof rows> {
  const byRole: Record<string, typeof rows> = {
    cbs: [],
    cro: [],
    cmo: [],
    cto: [],
  }

  for (const row of rows) {
    const t = row.type
    if (t === "staff_meeting") continue
    if (t === "daily_brief") byRole.cbs.push(row)
    else if (t.startsWith("lead")) byRole.cro.push(row)
    else if (t === "tech_radar") byRole.cto.push(row)
    else if (t === "content_technical") byRole.cto.push(row)
    else if (t.startsWith("content")) byRole.cmo.push(row)
  }

  return byRole
}

function buildStaffMeetingPrompt(
  companyContext: string,
  outputs: Record<string, unknown[]>,
  persistent?: {
    competitor: unknown[]
    funding: unknown[]
    security?: Array<{
      severity: string
      title: string
      category: string | null
      file_path: string | null
    }>
  },
): string {
  const sections: string[] = []

  sections.push(`You are the Chief of Staff for a startup. You are running the daily staff meeting.

Your job: read what each department did in the last 24 hours, find the connections they can't see individually, and produce actionable synthesis.

${companyContext}`)

  const cbs = outputs.cbs as Array<{ content: unknown }>
  const cro = outputs.cro as Array<{ content: unknown }>
  const cmo = outputs.cmo as Array<{ content: unknown }>
  const cto = outputs.cto as Array<{ content: unknown }>

  if (cbs.length > 0) {
    sections.push(`\n=== CBS (Chief Business Strategist) REPORT ===`)
    for (const row of cbs) {
      sections.push(JSON.stringify(row.content, null, 2).substring(0, 3000))
    }
  }

  if (cro.length > 0) {
    sections.push(`\n=== CRO (Chief Research Officer) REPORT ===`)
    sections.push(`${cro.length} leads/research items discovered:`)
    for (const row of cro.slice(0, 10)) {
      sections.push(JSON.stringify(row.content, null, 2).substring(0, 1000))
    }
  }

  if (cmo.length > 0) {
    sections.push(`\n=== CMO (Chief Marketing Officer) REPORT ===`)
    for (const row of cmo.slice(0, 5)) {
      sections.push(JSON.stringify(row.content, null, 2).substring(0, 1000))
    }
  }

  if (cto.length > 0) {
    sections.push(`\n=== CTO (Chief Technology Officer) REPORT ===`)
    for (const row of cto.slice(0, 5)) {
      sections.push(JSON.stringify(row.content, null, 2).substring(0, 1000))
    }
  }

  if (persistent?.competitor && persistent.competitor.length > 0) {
    sections.push(`\n=== COMPETITIVE LANDSCAPE (persistent tracking) ===`)
    sections.push(JSON.stringify(persistent.competitor, null, 2))
  }

  if (persistent?.funding && persistent.funding.length > 0) {
    sections.push(`\n=== FUNDING ACTIVITY IN OUR SPACE (persistent) ===`)
    sections.push(JSON.stringify(persistent.funding, null, 2))
  }

  if (persistent?.security && persistent.security.length > 0) {
    const criticalHigh = persistent.security.filter(
      (f) => f.severity === "critical" || f.severity === "high",
    )
    sections.push(`\n=== CTO: SECURITY FINDINGS (open) ===`)
    sections.push(`${persistent.security.length} open finding(s); ${criticalHigh.length} critical/high.`)
    for (const f of persistent.security.slice(0, 15)) {
      sections.push(
        `- [${f.severity}] ${f.title}${f.file_path ? ` (${f.file_path})` : ""}${f.category ? ` — ${f.category}` : ""}`,
      )
    }
    if (criticalHigh.length > 0) {
      sections.push(
        `\nRecommend: address critical/high security findings before shipping new features where applicable.`,
      )
    }
  }

  if (Object.values(outputs).every((arr) => (arr as unknown[]).length === 0)) {
    sections.push(`\n[No agent reports available for the last 24h]`)
  }

  sections.push(`\n=== YOUR TASK ===

Synthesise all reports into a staff meeting summary. Return JSON only (no markdown fences):

{
  "insights": [
    {
      "insight": "What you noticed that no single agent would see",
      "agents": ["cbs", "cro"],
      "significance": "high" | "medium" | "low"
    }
  ],
  "actions": [
    {
      "action": "Specific thing to do today or this week",
      "owner": "founder" | "cbs" | "cro" | "cmo" | "cto",
      "urgency": "today" | "this_week" | "backlog",
      "rationale": "Why this matters now, referencing specific agent findings"
    }
  ],
  "roadmapRecommendations": [
    {
      "recommendation": "Short label e.g. fast-track X or deprioritise Y",
      "evidence": "What signals from which agents support this",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "conflicts": [
    {
      "description": "Where two agents' findings contradict or create tension",
      "agents": ["cto", "cro"],
      "resolution": "Suggested way to resolve"
    }
  ],
  "executiveSummary": "3-5 sentence summary for the in-app feed. Lead with the most important insight. End with the #1 action for today."
}

Rules:
- Insights must reference findings from 2+ agents (that's the whole point)
- Actions must be specific and tied to agent findings, not generic advice
- If company context includes roadmap notes, reference them when recommending changes
- If there are no cross-cutting patterns, say so honestly — don't fabricate connections
- The executive summary should sound like a trusted advisor, not a report generator`)

  return sections.join("\n")
}

function formatMeetingForObsidian(
  synthesis: StaffMeetingSynthesis,
  date: string,
  outputs: Record<string, unknown[]>,
): string {
  const agentsCounted = Object.entries(outputs)
    .filter(([, items]) => (items as unknown[]).length > 0)
    .map(([role, items]) => `${role.toUpperCase()}: ${(items as unknown[]).length} items`)

  let md = `---\ndate: ${date}\ntype: staff-meeting\nagents: [${agentsCounted.join(", ")}]\n---\n\n`
  md += `# Staff Meeting — ${date}\n\n`

  md += `## Executive summary\n\n${synthesis.executiveSummary || "No synthesis."}\n\n`

  if (synthesis.insights?.length > 0) {
    md += `## Cross-cutting insights\n\n`
    for (const insight of synthesis.insights) {
      md += `- **[${insight.significance}]** ${insight.insight} _(${insight.agents?.join(", ")})_\n`
    }
    md += `\n`
  }

  if (synthesis.actions?.length > 0) {
    md += `## Action items\n\n`
    for (const action of synthesis.actions) {
      const check = action.urgency === "today" ? "🔴" : "🟡"
      md += `- [ ] ${check} **${action.action}** — ${action.owner} _(${action.urgency})_\n`
      md += `  ${action.rationale}\n`
    }
    md += `\n`
  }

  if (synthesis.roadmapRecommendations?.length > 0) {
    md += `## Roadmap recommendations\n\n`
    for (const rec of synthesis.roadmapRecommendations) {
      md += `- **${rec.recommendation}** [${rec.confidence} confidence]\n`
      md += `  Evidence: ${rec.evidence}\n`
    }
    md += `\n`
  }

  if (synthesis.conflicts?.length > 0) {
    md += `## Tensions to resolve\n\n`
    for (const conflict of synthesis.conflicts) {
      md += `- ⚠️ ${conflict.description} _(${conflict.agents?.join(" vs ")})_\n`
      md += `  → ${conflict.resolution}\n`
    }
  }

  return md
}

// ─── Fan-out ─────────────────────────────────────────────────────

export const staffMeetingFanOut = inngest.createFunction(
  {
    id: "staff-meeting-fanout",
    name: "Staff Meeting Fan-Out",
    triggers: [{ cron: "30 8 * * *" }],
  },
  async ({ step }) => {
    const userIds = await step.run("load-users", getActiveUserIds)

    if (userIds.length > 0) {
      await step.sendEvent(
        "fan-out-staff-meeting",
        userIds.map((userId) => ({
          name: "juno/staff-meeting.requested" as const,
          data: { userId },
        })),
      )
    }

    return { users: userIds.length }
  },
)

// ─── Per-user staff meeting ──────────────────────────────────────

export const staffMeeting = inngest.createFunction(
  {
    id: "staff-meeting",
    name: "Daily Staff Meeting",
    retries: 2,
    concurrency: { limit: 3 },
    triggers: [{ event: "juno/staff-meeting.requested" }],
  },
  async ({ event, step }) => {
    const { userId } = event.data as { userId: string }

    const context = await step.run("load-context", () =>
      getCompanyContext(userId, {
        queryHint: "strategy roadmap priorities goals current focus",
      }),
    )

    const companyBlock = context?.promptBlock?.trim() ? context.promptBlock : ""

    const agentOutputs = await step.run("load-agent-outputs", async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("[staff-meeting] missing Supabase env")
        return [] as Array<{ type: string; content: unknown; metadata: unknown; created_at: string }>
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabaseAdmin
        .from("ai_outputs")
        .select("id, tool, title, inputs, output, metadata, created_at")
        .eq("user_id", userId)
        .neq("tool", "staff_meeting")
        .gte("created_at", since)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("[staff-meeting] Failed to load agent outputs:", error.message)
        return []
      }

      return (data ?? []).map((r) => {
        const legacy = toLegacyFeedRow(r as AiOutputDbRow)
        return {
          type: legacy.type,
          content: legacy.content,
          metadata: legacy.metadata,
          created_at: legacy.created_at,
        }
      })
    })

    const persistent = await step.run("load-competitor-funding-security", async () => {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return {
          competitor: [] as unknown[],
          funding: [] as unknown[],
          security: [] as Array<{
            severity: string
            title: string
            category: string | null
            file_path: string | null
          }>,
        }
      }
      const [competitor, funding, secRes] = await Promise.all([
        loadCompetitorTrackingRecent(userId, 20),
        loadFundingTrackerRecent(userId, 20),
        supabaseAdmin
          .from("security_findings")
          .select("severity, title, category, file_path")
          .eq("user_id", userId)
          .eq("status", "open"),
      ])
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      let security: Array<{
        severity: string
        title: string
        category: string | null
        file_path: string | null
      }> = []
      if (secRes.error) {
        console.warn("[staff-meeting] security_findings:", secRes.error.message)
      } else {
        security = (secRes.data ?? []).sort(
          (a, b) => (order[String(a.severity)] ?? 9) - (order[String(b.severity)] ?? 9),
        )
      }
      return { competitor, funding, security }
    })

    if (agentOutputs.length === 0) {
      const critHigh =
        persistent.security?.filter((f) => f.severity === "critical" || f.severity === "high") ?? []
      if (critHigh.length === 0) {
        return { userId, skipped: true, reason: "No agent outputs in last 24h" }
      }
    }

    const organised = await step.run("organise-outputs", () => organiseByRole(agentOutputs))

    const synthesis = await step.run("synthesise", async (): Promise<StaffMeetingSynthesis> => {
      if (!process.env.ANTHROPIC_API_KEY) {
        return {
          insights: [],
          actions: [],
          roadmapRecommendations: [],
          conflicts: [],
          executiveSummary: "Staff meeting skipped: ANTHROPIC_API_KEY is not set.",
        }
      }

      const prompt = buildStaffMeetingPrompt(companyBlock, organised, persistent)

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages: [{ role: "user", content: appendWritingRules(prompt) }],
      })

      const text = extractText(response)
      return parseSynthesisJson(text)
    })

    await step.run("save-meeting", async () => {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return

      const dateStr = new Date().toISOString().slice(0, 10)
      const { error } = await supabaseAdmin.from("ai_outputs").insert({
        user_id: userId,
        tool: "staff_meeting",
        title: `Staff meeting — ${dateStr}`,
        output: synthesis.executiveSummary ?? "",
        inputs: { synthesis },
        metadata: {
          generated_at: new Date().toISOString(),
          agent_outputs_count: agentOutputs.length,
          agents_reporting: Object.entries(organised)
            .filter(([, items]) => items.length > 0)
            .map(([role]) => role),
        },
      })

      if (error) console.error("[staff-meeting] save-meeting:", error.message)
    })

    await step.run("write-to-vault", async () => {
      try {
        const { writeVaultFile } = await import("@/lib/juno/vault")
        const date = new Date().toISOString().split("T")[0]
        const md = formatMeetingForObsidian(synthesis, date, organised)
        const r = await writeVaultFile(
          `juno/staff-meeting/${date}.md`,
          md,
          `Juno: Staff meeting for ${date}`,
          userId,
        )
        if (!r.success && r.error && r.error !== "Vault not configured") {
          console.warn("[staff-meeting] vault:", r.error)
        }
      } catch (e) {
        console.warn("[staff-meeting] write-to-vault:", e instanceof Error ? e.message : e)
      }
    })

    return {
      userId,
      agentOutputs: agentOutputs.length,
      agentsReporting: Object.entries(organised)
        .filter(([, items]) => items.length > 0)
        .map(([role]) => role),
      insightsGenerated: synthesis.insights?.length || 0,
      actionsGenerated: synthesis.actions?.length || 0,
    }
  },
)

/**
 * POST /api/delegate
 *
 * Receives a strategic goal from the user and uses Claude to:
 * 1. Decompose it into concrete tasks for each relevant executive agent
 * 2. Create a Paperclip goal (if Paperclip is online)
 * 3. Return the breakdown so the frontend can execute each task via /api/ai-tool
 *
 * This is the bridge between Paperclip's organisational layer and our tool execution layer.
 * Paperclip manages WHO does WHAT. Our tools determine HOW.
 */

import { NextResponse } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import { createClient } from "@/lib/supabase/server"
import { TOOLS, AGENT_LABELS } from "@/lib/ai-tools"
import { getCompanyContextPrompt } from "@/lib/company-context"

interface PlannedTask {
  agent: string          // cbs | cro | cmo | cfo | coo
  agentLabel: string
  tool: string           // tool ID from lib/ai-tools.ts
  toolLabel: string
  title: string          // specific task title
  rationale: string      // why this agent/tool was chosen
  inputs: Record<string, string>
}

interface PlanResponse {
  goal: string
  breakdown: string     // CEO-level explanation of the delegation
  tasks: PlannedTask[]
  paperclipGoalId?: string
}

// Map tool IDs to their available input field keys (for grounding the AI's output)
function toolInputKeys(toolId: string): string[] {
  return TOOLS[toolId]?.fields.map((f) => f.key) ?? []
}

const PLANNING_SYSTEM_PROMPT = `You are the AI chief of staff for a startup. A founder has given you a strategic goal.
Your job is to decompose that goal into specific, actionable work items for the executive team.

The executive agents and their tools are:
- CBS (Chief Business Strategist): opportunity-scanner
- CRO (Chief Research Officer): competition-advanced
- CMO (Chief Marketing Officer): global-events, internationalisation
- CFO (Chief Financial Officer): financial-engineering, funding-readiness, funding-strategy, cap-table, startup-credits
- COO (Chief Operating Officer): llc-formation, legal-requirements, recruiting, business-plan

Tool input fields:
- opportunity-scanner: {"Industry", "Focus Area", "Target Market", "Stage"}
- competition-advanced: {"Startup", "Industry", "Key Competitors"}
- global-events: {"Industry", "Stage", "Location"}
- internationalisation: {"Startup", "Current Market", "Target Markets", "Industry"}
- financial-engineering: {"Business Model", "Industry", "Stage", "Target Revenue"}
- funding-readiness: {"Startup", "Stage", "Current Traction"}
- funding-strategy: {"Startup", "Stage", "Amount", "Use of Funds"}
- cap-table: {"Founders", "Stage", "Investors"}
- startup-credits: {"Stage", "Industry"}
- llc-formation: {"Location", "Industry", "Fundraising Plans"}
- legal-requirements: {"Industry", "Location", "Stage"}
- recruiting: {"Current Team", "Stage", "Priority Hire"}
- business-plan: {"Startup", "Industry", "Stage", "Funding Goal"}

RULES:
- Only select tools that are directly useful for achieving the stated goal
- Select 2-5 tasks maximum — be focused, not exhaustive
- Fill in the tool inputs using context from the goal and startup details provided
- Return ONLY valid JSON, no prose outside the JSON block

Return this exact JSON structure:
{
  "breakdown": "2-3 sentence explanation of how you are decomposing this goal across the team",
  "tasks": [
    {
      "agent": "cfo",
      "tool": "funding-readiness",
      "title": "Assess Fundraising Readiness",
      "rationale": "Before approaching investors we need to know our score",
      "inputs": {
        "Startup": "...",
        "Stage": "mvp",
        "Current Traction": "..."
      }
    }
  ]
}`

export async function POST(request: Request) {
  try {
    const { goal, context } = await request.json()

    if (!goal?.trim()) {
      return NextResponse.json({ error: "Goal is required" }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const companyContext = await getCompanyContextPrompt(user?.id)
    const startupContext = context?.trim() || companyContext || "Not provided"

    // ── Step 1: Use Claude to plan the delegation ──────────────────────────
    const userPrompt = `STRATEGIC GOAL: ${goal}\n\nSTARTUP CONTEXT:\n${startupContext}`

    const { text: planText } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: PLANNING_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 2000,
      temperature: 0.3,
    })

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = planText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      planText.match(/(\{[\s\S]*\})/)
    if (!jsonMatch) {
      throw new Error("Failed to parse planning response")
    }

    let plan: { breakdown: string; tasks: Array<{ agent: string; tool: string; title: string; rationale: string; inputs: Record<string, string> }> }
    try {
      plan = JSON.parse(jsonMatch[1] || jsonMatch[0])
    } catch {
      throw new Error("Invalid JSON in planning response")
    }

    // ── Step 2: Enrich tasks with labels and validate tool IDs ────────────
    const tasks: PlannedTask[] = (plan.tasks || [])
      .filter((t) => TOOLS[t.tool]) // only keep tasks with valid tool IDs
      .map((t) => {
        // Only keep inputs whose keys match the tool's actual fields
        const validKeys = new Set(toolInputKeys(t.tool))
        const cleanedInputs: Record<string, string> = {}
        for (const [k, v] of Object.entries(t.inputs || {})) {
          if (validKeys.has(k) && v) cleanedInputs[k] = String(v)
        }
        return {
          agent: t.agent,
          agentLabel: AGENT_LABELS[t.agent] ?? t.agent,
          tool: t.tool,
          toolLabel: TOOLS[t.tool].label,
          title: t.title,
          rationale: t.rationale,
          inputs: cleanedInputs,
        }
      })

    // ── Step 3: Create Paperclip goal (non-blocking, best-effort) ─────────
    let paperclipGoalId: string | undefined
    try {
      const companiesRes = await fetch(
        `${process.env.PAPERCLIP_URL || "http://localhost:3100"}/api/companies`,
        { signal: AbortSignal.timeout(2000) },
      )
      if (companiesRes.ok) {
        const companies: Array<{ id: string }> = await companiesRes.json()
        if (companies.length > 0) {
          const goalRes = await fetch(
            `${process.env.PAPERCLIP_URL || "http://localhost:3100"}/api/companies/${companies[0].id}/goals`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: goal.slice(0, 100),
                description: `${plan.breakdown}\n\nDelegated tasks: ${tasks.map((t) => `${t.agentLabel}: ${t.title}`).join(", ")}`,
              }),
            },
          )
          if (goalRes.ok) {
            const goalData = await goalRes.json()
            paperclipGoalId = goalData.id
          }
        }
      }
    } catch {
      // Paperclip offline — that's OK, we continue without it
    }

    const response: PlanResponse = {
      goal,
      breakdown: plan.breakdown,
      tasks,
      ...(paperclipGoalId ? { paperclipGoalId } : {}),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Delegation planning error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to plan delegation" },
      { status: 500 },
    )
  }
}

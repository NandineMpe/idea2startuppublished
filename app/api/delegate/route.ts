/**
 * POST /api/delegate
 *
 * Receives a strategic goal from the user and uses the LLM to:
 * 1. Decompose it into concrete tasks for each relevant executive agent
 * 2. Return the breakdown so the frontend can execute each task via /api/ai-tool
 *
 * Planning selects WHO does WHAT; tool routes determine HOW.
 */

import { NextResponse } from "next/server"
import { qwenModel } from "@/lib/llm-provider"
import { jsonApiError } from "@/lib/api-error-response"
import { generateText } from "ai"
import { createClient } from "@/lib/supabase/server"
import { TOOLS, AGENT_LABELS } from "@/lib/ai-tools"
import { getCompanyContextPrompt } from "@/lib/company-context"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"

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

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const companyContext = await getCompanyContextPrompt(user?.id, { useCookieWorkspace: true })
    const startupContext = context?.trim() || companyContext || "Not provided"

    // ── Step 1: Use Claude to plan the delegation ──────────────────────────
    const userPrompt = `STRATEGIC GOAL: ${goal}\n\nSTARTUP CONTEXT:\n${startupContext}`

    const { text: planText } = await generateText({
      model: qwenModel(),
      system: mergeSystemWithWritingRules(PLANNING_SYSTEM_PROMPT),
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

    const response: PlanResponse = {
      goal,
      breakdown: plan.breakdown,
      tasks,
    }

    return NextResponse.json(response)
  } catch (error) {
    return jsonApiError(500, error, "delegate POST")
  }
}

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContext } from "@/lib/company-context"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import { generateText } from "ai"
import { tryParseJsonObject } from "@/lib/parse-llm-json"
import { resolveWorkspaceSelection } from "@/lib/workspaces"
import type { StaffMeetingSynthesis } from "@/lib/staff-meeting-types"

export const maxDuration = 90
export const dynamic = "force-dynamic"

const AGENT_ORDER = ["cbs", "cro", "cmo", "cto"] as const
type AgentRole = (typeof AGENT_ORDER)[number]

const AGENT_LABELS: Record<AgentRole, string> = {
  cbs: "CBS (Chief Business Strategist): market brief, competitive and funding context",
  cro: "CRO (Chief Research Officer): leads, pipeline, behavioral and ICP signals",
  cmo: "CMO (Chief Marketing Officer): content, brand, distribution, narrative",
  cto: "CTO (Chief Technology Officer): tech radar, architecture, security and engineering bets",
}

const MAX_CONTEXT_CHARS = 10_000

function trimContext(block: string): string {
  if (block.length <= MAX_CONTEXT_CHARS) return block
  return `${block.slice(0, MAX_CONTEXT_CHARS)}\n\n…(truncated)`
}

function strField(v: unknown): string {
  if (typeof v === "string") return v.trim()
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function normalizeReplies(
  raw: Array<{ role?: string; reply?: string }> | undefined,
): Array<{ role: AgentRole; label: string; reply: string }> {
  const byRole = new Map<AgentRole, string>()
  for (const row of raw ?? []) {
    const r = typeof row.role === "string" ? row.role.toLowerCase().trim() : ""
    if (r === "cbs" || r === "cro" || r === "cmo" || r === "cto") {
      const reply = typeof row.reply === "string" ? row.reply.trim() : ""
      if (reply) byRole.set(r, reply)
    }
  }
  return AGENT_ORDER.map((role) => ({
    role,
    label: AGENT_LABELS[role],
    reply:
      byRole.get(role) ??
      `No extra angle from ${role.toUpperCase()} on this question beyond the shared meeting summary. Ask a follow-up if you need depth in this lane.`,
  }))
}

/**
 * POST /api/staff-meetings/ask
 * Multi-agent follow-up grounded in one saved staff meeting synthesis + optional founder notes.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: "LLM not configured" }, { status: 503 })
    }

    const workspace = await resolveWorkspaceSelection(user.id, { useCookieWorkspace: true })
    if (workspace) {
      return NextResponse.json({
        error:
          "Staff meeting Q&A is available on your main workspace. Switch out of client workspace mode to use it.",
      }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
      const raw = await req.text()
      if (!raw.trim()) {
        return NextResponse.json({ error: "Request body is empty." }, { status: 400 })
      }
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Expected a JSON object in the body." }, { status: 400 })
      }
      body = parsed as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    let meetingId = strField(body.meetingId ?? body.meeting_id)
    const question = strField(body.question)
    const founderNotes = strField(body.founderNotes ?? body.founder_notes)

    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 })
    }

    if (!meetingId) {
      const { data: latest } = await supabase
        .from("ai_outputs")
        .select("id")
        .eq("user_id", user.id)
        .eq("tool", "staff_meeting")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      meetingId = typeof latest?.id === "string" ? latest.id.trim() : ""
    }

    if (!meetingId) {
      return NextResponse.json(
        { error: "meetingId is required, or save at least one staff meeting first." },
        { status: 400 },
      )
    }

    const { data: row, error: rowError } = await supabase
      .from("ai_outputs")
      .select("id, tool, inputs, output, created_at")
      .eq("id", meetingId)
      .eq("user_id", user.id)
      .eq("tool", "staff_meeting")
      .maybeSingle()

    if (rowError) {
      console.error("[staff-meetings/ask] load:", rowError.message)
      return NextResponse.json({ error: "Could not load that meeting." }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: "Meeting not found." }, { status: 404 })
    }

    const inputs = (row.inputs ?? {}) as { synthesis?: StaffMeetingSynthesis }
    const synthesis =
      inputs.synthesis && typeof inputs.synthesis === "object"
        ? inputs.synthesis
        : ({
            executiveSummary: typeof row.output === "string" ? row.output : "",
            insights: [],
            actions: [],
            roadmapRecommendations: [],
            conflicts: [],
          } satisfies StaffMeetingSynthesis)

    const context = await getCompanyContext(user.id, {
      queryHint: "priorities roadmap decisions founder context",
      refreshVault: "if_stale",
    })
    const contextBlock =
      context?.promptBlock && context.scope !== "workspace"
        ? trimContext(context.promptBlock)
        : ""

    const meetingJson = JSON.stringify(synthesis, null, 2).slice(0, 24_000)

    const notesBlock =
      founderNotes.length > 0
        ? `FOUNDER NOTES (your contribution / priorities for this meeting; weight these heavily):\n${founderNotes.slice(0, 4000)}\n\n`
        : ""

    const prompt = `You are facilitating a short follow-up roundtable for a founder who already ran their daily Juno staff meeting. Each agent speaks in character, using ONLY the meeting synthesis below, the founder notes (if any), and light use of company context. Do not invent pipeline facts that are not implied by the synthesis or notes.

MEETING DATE (ISO): ${row.created_at}

MEETING SYNTHESIS (JSON):
${meetingJson}

${notesBlock}${
      contextBlock
        ? `COMPANY CONTEXT (truncated):\n${contextBlock}\n\n`
        : ""
    }FOUNDER QUESTION:
"${question}"

TASK:
1. Write executiveSummary: 2-4 sentences that tie the agents together and answer the question at a glance.
2. Write agentReplies: exactly one object per role in this order: cbs, cro, cmo, cto. Each reply is 2-5 sentences, practical, and cites which part of the meeting (insight, action, roadmap, conflict) it builds on when possible. If this agent had little to say for this specific question, say so honestly and offer one useful lens anyway.

Return ONLY valid JSON (no markdown fences):
{
  "executiveSummary": "string",
  "agentReplies": [
    { "role": "cbs", "reply": "string" },
    { "role": "cro", "reply": "string" },
    { "role": "cmo", "reply": "string" },
    { "role": "cto", "reply": "string" }
  ]
}`

    let text: string
    try {
      const out = await generateText({
        model: qwenModel(),
        maxOutputTokens: 2800,
        messages: [{ role: "user", content: appendWritingRules(prompt) }],
      })
      text = out.text
    } catch (llmErr) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
      console.error("[staff-meetings/ask] LLM:", llmErr)
      return NextResponse.json(
        {
          error:
            msg.length > 0 && msg.length < 400
              ? msg
              : "The language model request failed. Check API keys and try again.",
        },
        { status: 502 },
      )
    }

    const parsed = tryParseJsonObject<{
      executiveSummary?: string
      agentReplies?: Array<{ role?: string; reply?: string }>
    }>(text)

    let executiveSummary =
      typeof parsed?.executiveSummary === "string" ? parsed.executiveSummary.trim() : ""
    const agentReplies = normalizeReplies(parsed?.agentReplies)

    if (!executiveSummary) {
      const fallback = text?.trim().slice(0, 2000) ?? ""
      executiveSummary =
        fallback.length > 80
          ? `Could not parse structured replies. Raw model output (trimmed):\n\n${fallback}`
          : "The model returned an empty reply. Try a shorter or clearer question."
    }

    return NextResponse.json({
      executiveSummary,
      agentReplies,
      meetingId: row.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[staff-meetings/ask] error:", err)
    return NextResponse.json(
      { error: message.length < 500 ? message : "Request failed. Try again." },
      { status: 500 },
    )
  }
}

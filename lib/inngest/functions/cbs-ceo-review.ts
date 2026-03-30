import Anthropic from "@anthropic-ai/sdk"
import { inngest } from "@/lib/inngest/client"
import { getCompanyContext } from "@/lib/company-context"
import { getFanOutUserIds } from "@/lib/juno/users"
import { supabaseAdmin } from "@/lib/supabase"
import { JUNO_CEO_REVIEW_REQUESTED } from "@/lib/inngest/event-names"

const anthropic = new Anthropic()

// ─── Types ────────────────────────────────────────────────────────

type InsightType = "10_star_product" | "wrong_problem" | "icp_drift" | "timing_window" | "leverage_point"

interface StrategicInsight {
  type: InsightType
  insight: string
  evidence: string
  action: string
}

export interface CeoReviewData {
  pitchArticulation: {
    thirtySecondVersion: string
    oneSentence: string
    howYouDiffer: string
    whyNow: string
  }
  strategicInsights: StrategicInsight[]
  criticalGaps: string[]
  scopeRecommendation: "EXPAND" | "HOLD" | "REDUCE"
  scopeReasoning: string
  weeklyAssignment: string
}

// ─── Fan-out ─────────────────────────────────────────────────────

export const cbsCeoReviewFanOut = inngest.createFunction(
  {
    id: "cbs-ceo-review-fanout",
    name: "CBS: CEO Review Fan-Out",
    triggers: [{ cron: "0 6 * * *" }],
  },
  async ({ step }) => {
    const userIds = await step.run("load-users", getFanOutUserIds)

    if (userIds.length > 0) {
      await step.sendEvent(
        "fan-out-ceo-review",
        userIds.map((userId) => ({
          name: JUNO_CEO_REVIEW_REQUESTED,
          data: { userId },
        })),
      )
    }

    return { users: userIds.length }
  },
)

// ─── Per-user CEO review ──────────────────────────────────────────

export const cbsCeoReview = inngest.createFunction(
  {
    id: "cbs-ceo-review",
    name: "CBS: CEO Strategic Review",
    retries: 1,
    concurrency: { limit: 3 },
    triggers: [{ event: JUNO_CEO_REVIEW_REQUESTED }],
  },
  async ({ event, step }) => {
    const { userId } = event.data as { userId: string }

    // ── Step 1: Load company context (profile, ICP, thesis, branding, vault) ──
    const context = await step.run("load-context", () => getCompanyContext(userId))

    // ── Step 2: Load live business data ──────────────────────────────────────
    const liveData = await step.run("load-live-data", async () => {
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [conversionsRes, pipelineRes, contentRes, securityRes, staffMeetingsRes] = await Promise.all([
        // Recent conversions
        supabaseAdmin
          .from("cro_leads")
          .select("company_name, title, notes, score, created_at")
          .eq("user_id", userId)
          .eq("status", "converted")
          .gte("created_at", thirtyDaysAgo)
          .order("created_at", { ascending: false })
          .limit(10),

        // Full pipeline stats
        supabaseAdmin
          .from("cro_leads")
          .select("status, score, outreach_sent, replied")
          .eq("user_id", userId),

        // Recent content performance
        supabaseAdmin
          .from("content_items")
          .select("title, platform, engagement_score, status, created_at")
          .eq("user_id", userId)
          .gte("created_at", sevenDaysAgo)
          .order("engagement_score", { ascending: false })
          .limit(15),

        // Open security findings by severity
        supabaseAdmin
          .from("security_findings")
          .select("severity")
          .eq("user_id", userId)
          .eq("status", "open"),

        // Staff meeting summaries from last 7 days
        supabaseAdmin
          .from("ai_outputs")
          .select("content, created_at")
          .eq("user_id", userId)
          .eq("source", "staff-meeting")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: false })
          .limit(3),
      ])

      const conversions = conversionsRes.data ?? []
      const allLeads = pipelineRes.data ?? []
      const content = contentRes.data ?? []
      const securityFindings = securityRes.data ?? []
      const staffMeetings = staffMeetingsRes.data ?? []

      // Compute pipeline stats
      const totalLeads = allLeads.length
      const avgScore =
        totalLeads > 0
          ? Math.round(allLeads.reduce((sum, l) => sum + (Number(l.score) || 0), 0) / totalLeads)
          : 0
      const outreachSent = allLeads.filter((l) => l.outreach_sent).length
      const replied = allLeads.filter((l) => l.replied).length
      const replyRate = outreachSent > 0 ? Math.round((replied / outreachSent) * 100) : 0

      // Security counts
      const secCounts = { critical: 0, high: 0, medium: 0, low: 0 }
      for (const f of securityFindings) {
        const s = String(f.severity || "").toLowerCase()
        if (s === "critical") secCounts.critical++
        else if (s === "high") secCounts.high++
        else if (s === "medium") secCounts.medium++
        else if (s === "low") secCounts.low++
      }

      return {
        conversions,
        pipeline: { totalLeads, avgScore, outreachSent, replied, replyRate },
        content,
        security: secCounts,
        staffMeetings: staffMeetings.map((m) => m.content as string),
      }
    })

    // ── Step 3: Claude CEO review ─────────────────────────────────────────────
    const reviewData = await step.run("analyse", async (): Promise<CeoReviewData | null> => {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.warn("[ceo-review] ANTHROPIC_API_KEY missing")
        return null
      }

      const prompt = buildCeoReviewPrompt(context.promptBlock, liveData)
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: CEO_REVIEW_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      })

      const text = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("")

      return parseCeoReviewJson(text)
    })

    if (!reviewData) {
      return { status: "skipped", reason: "no_api_key_or_parse_failure" }
    }

    // ── Step 4: Save review (upsert on user_id + review_date) ────────────────
    await step.run("save-review", async () => {
      const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

      const { error } = await supabaseAdmin.from("ceo_reviews").upsert(
        {
          user_id: userId,
          review_date: today,
          review_data: reviewData,
        },
        { onConflict: "user_id,review_date" },
      )

      if (error) {
        console.error("[ceo-review] save:", error.message)
        throw error
      }
    })

    return {
      status: "completed",
      userId,
      insightCount: reviewData.strategicInsights.length,
      gapCount: reviewData.criticalGaps.length,
      scopeRecommendation: reviewData.scopeRecommendation,
    }
  },
)

// ─── Prompt builders ─────────────────────────────────────────────

const CEO_REVIEW_SYSTEM_PROMPT = `You are a CEO advisor who thinks like Garry Tan — direct, evidence-based, uncomfortable when necessary.

Apply these cognitive patterns to every analysis:
- **Inversion reflex**: For every "how do we win?" ask "what makes us fail?" Name the specific failure modes.
- **Proxy skepticism**: Are the metrics still pointing at real user value, or have they become self-referential? Call it out.
- **Focus as subtraction**: What should they STOP doing? Every insight that isn't "do this instead of that" is incomplete.
- **10-star product thinking**: What's the platonic ideal of this product? Not the roadmap — the thing they're actually building toward.
- **Wrong problem detection**: Are they solving the stated problem or the real problem? Conversions reveal what customers actually pay for.
- **Paranoid scanning**: Scan for ICP drift, positioning erosion, timing windows closing.

Rules:
- Every insight must cite specific data from the context provided. No generic advice.
- Be direct about what's not working. Founders read this alone — they can handle truth.
- The weekly assignment must be ONE concrete action, not a theme.
- Pitch articulation should be rewritten based on what's ACTUALLY working (conversions), not what the founder thinks sounds good.

Output ONLY valid JSON matching this exact schema — no markdown, no explanation, just JSON:
{
  "pitchArticulation": {
    "thirtySecondVersion": "string",
    "oneSentence": "string",
    "howYouDiffer": "string",
    "whyNow": "string"
  },
  "strategicInsights": [
    {
      "type": "10_star_product | wrong_problem | icp_drift | timing_window | leverage_point",
      "insight": "string",
      "evidence": "string",
      "action": "string"
    }
  ],
  "criticalGaps": ["string"],
  "scopeRecommendation": "EXPAND | HOLD | REDUCE",
  "scopeReasoning": "string",
  "weeklyAssignment": "string"
}`

function buildCeoReviewPrompt(
  contextBlock: string,
  liveData: {
    conversions: Array<{ company_name: unknown; title: unknown; notes: unknown; score: unknown }>
    pipeline: { totalLeads: number; avgScore: number; outreachSent: number; replied: number; replyRate: number }
    content: Array<{ title: unknown; platform: unknown; engagement_score: unknown; status: unknown }>
    security: { critical: number; high: number; medium: number; low: number }
    staffMeetings: string[]
  },
): string {
  const conversionsText =
    liveData.conversions.length > 0
      ? liveData.conversions
          .map(
            (c) =>
              `- ${c.company_name ?? "Unknown"} (${c.title ?? ""}): score ${c.score ?? "n/a"}${c.notes ? ` — "${c.notes}"` : ""}`,
          )
          .join("\n")
      : "No conversions in the last 30 days."

  const contentText =
    liveData.content.length > 0
      ? liveData.content
          .slice(0, 5)
          .map((c) => `- [${c.platform}] "${c.title}" — engagement: ${c.engagement_score ?? 0}`)
          .join("\n")
      : "No content data available."

  const staffText =
    liveData.staffMeetings.length > 0
      ? liveData.staffMeetings.map((s, i) => `Meeting ${i + 1}:\n${s}`).join("\n\n")
      : "No staff meeting summaries in the last 7 days."

  return `## Company Context

${contextBlock}

---

## Live Business Data (as of today)

### Recent Conversions (last 30 days)
${conversionsText}

### Lead Pipeline
- Total leads tracked: ${liveData.pipeline.totalLeads}
- Average lead score: ${liveData.pipeline.avgScore}/100
- Outreach sent: ${liveData.pipeline.outreachSent}
- Replies received: ${liveData.pipeline.replied}
- Reply rate: ${liveData.pipeline.replyRate}%

### Content Performance (last 7 days)
${contentText}

### Security Posture (open findings)
- Critical: ${liveData.security.critical}
- High: ${liveData.security.high}
- Medium: ${liveData.security.medium}
- Low: ${liveData.security.low}

### Staff Meeting Summaries (last 7 days)
${staffText}

---

Review this business. Apply the CEO cognitive patterns from your system prompt. Produce the JSON review.`
}

function parseCeoReviewJson(text: string): CeoReviewData | null {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim()

  // Find JSON object boundaries
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1) {
    console.error("[ceo-review] No JSON found in response")
    return null
  }

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as CeoReviewData
    // Basic validation
    if (!parsed.pitchArticulation || !parsed.strategicInsights || !parsed.weeklyAssignment) {
      console.error("[ceo-review] JSON missing required fields")
      return null
    }
    return parsed
  } catch (e) {
    console.error("[ceo-review] JSON parse error:", e)
    return null
  }
}

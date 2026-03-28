import { inngest } from "@/lib/inngest/client"
import { getActiveUserIds, getCompanyContext } from "@/lib/company-context"
import { generateComments, generateLinkedInPost } from "@/lib/juno/ai-engine"
import { loadDismissalFeedbackPromptSection } from "@/lib/content-preferences"
import { insertContentCalendarRow } from "@/lib/content-calendar"
import { saveContentToDB } from "@/lib/juno/delivery"
import type { ScoredItem } from "@/lib/juno/scoring"
import type { DailyBriefPayload } from "@/lib/juno/types"

// ─── Content Engine (chains from daily brief) ────────────────────

export const contentEngine = inngest.createFunction(
  {
    id: "cmo-content-engine",
    name: "CMO: Content Engine",
    retries: 2,
    triggers: [{ event: "juno/brief.generated" }],
  },
  async ({ event, step }) => {
    const data = event.data as DailyBriefPayload & { items?: ScoredItem[] }
    const { userId } = data
    const briefItems = (data.items ?? data.scoredItems ?? []) as ScoredItem[]

    const context = await step.run("load-context", () =>
      getCompanyContext(userId, {
        queryHint: "brand voice product positioning thought leadership",
      }),
    )

    if (!context) {
      await step.sendEvent("content-ready-skipped", {
        name: "juno/content.ready",
        data: {
          userId,
          contentId: null,
          platform: "linkedin",
          type: "post",
          angle: "",
          skipped: true,
          reason: "no_company_profile",
        },
      })
      return { userId, skipped: true as const }
    }

    const linkedinPost = await step.run("generate-post", () =>
      generateLinkedInPost({ context, briefItems }),
    )

    const contentId = await step.run("save-draft", () =>
      saveContentToDB({
        userId,
        platform: "linkedin",
        contentType: "post",
        body: linkedinPost.post,
        status: "pending_approval",
      }),
    )

    await step.run("add-to-calendar", async () => {
      if (!contentId) return
      await insertContentCalendarRow({
        userId,
        title: linkedinPost.angle,
        body: linkedinPost.post,
        channel: "linkedin",
        contentType: "post",
        scheduledDate: new Date().toISOString().split("T")[0],
        status: "draft",
        source: "cmo_agent",
        sourceRef: contentId,
        angle: linkedinPost.angle,
      })
    })

    await step.run("write-draft-to-vault", async () => {
      const { writeVaultFile } = await import("@/lib/juno/vault")
      const date = new Date().toISOString().split("T")[0]
      const md = [
        `---`,
        `date: ${date}`,
        `type: linkedin-draft`,
        `platform: linkedin`,
        `---`,
        ``,
        `# LinkedIn draft — ${date}`,
        ``,
        `**Angle:** ${linkedinPost.angle}`,
        ``,
        linkedinPost.post,
      ].join("\n")
      const r = await writeVaultFile(`juno/content/${date}-linkedin.md`, md, `Juno: LinkedIn draft ${date}`, userId)
      if (!r.success && r.error) {
        console.warn("[CMO] vault write:", r.error)
      }
    })

    await step.sendEvent("content-ready", {
      name: "juno/content.ready",
      data: {
        userId,
        contentId,
        platform: "linkedin",
        type: "post",
        angle: linkedinPost.angle,
      },
    })

    return { userId, contentId, angle: linkedinPost.angle }
  },
)

// ─── Comment Engine ──────────────────────────────────────────────

export const commentEngine = inngest.createFunction(
  {
    id: "cmo-comment-engine",
    name: "CMO: Comment Engine",
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [{ cron: "0 8,12,16 * * 1-5" }],
  },
  async ({ step }) => {
    const userIds = await step.run("load-users", getActiveUserIds)

    let total = 0
    for (const [i, userId] of userIds.entries()) {
      const context = await step.run(`context-${i}`, () =>
        getCompanyContext(userId, { queryHint: "expertise domain knowledge opinions" }),
      )

      if (!context) continue

      const comments = await step.run(`comments-${i}`, () =>
        generateComments({ context, targetPosts: [] }),
      )

      for (const [ci, comment] of comments.entries()) {
        await step.run(`save-${i}-${ci}`, () =>
          saveContentToDB({
            userId,
            platform: "linkedin",
            contentType: "comment",
            body: JSON.stringify(comment),
            status: "draft",
          }),
        )
        total++
      }
    }

    return { comments: total }
  },
)

// ─── Relationship Tracker ────────────────────────────────────────

export const relationshipTracker = inngest.createFunction(
  {
    id: "cmo-relationship-tracker",
    name: "CMO: Relationship Tracker",
    retries: 1,
    triggers: [{ event: "juno/content.published" }],
  },
  async ({ event, step }) => {
    await step.run("track", async () => {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("[CMO] relationshipTracker: no SUPABASE_SERVICE_ROLE_KEY")
        return
      }
      const payload = event.data as Record<string, unknown> & { userId?: string }
      const userId = payload.userId
      if (!userId) {
        console.warn("[CMO] relationshipTracker: missing userId")
        return
      }

      const { supabaseAdmin } = await import("@/lib/supabase")
      const at = new Date().toISOString()
      const { error } = await supabaseAdmin.from("ai_outputs").insert({
        user_id: userId,
        tool: "relationship_interaction",
        title: "Relationship interaction",
        output: "",
        inputs: { ...payload, date: at },
        metadata: { tracked_at: at },
      })
      if (error) console.error("[CMO] relationshipTracker:", error.message)
    })

    return { tracked: true as const }
  },
)

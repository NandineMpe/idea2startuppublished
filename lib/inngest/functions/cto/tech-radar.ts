import { inngest } from "@/lib/inngest/client"
import { getActiveUserIds, getCompanyContext } from "@/lib/company-context"
import { analyzeTechTrends } from "@/lib/juno/ai-engine"
import { saveContentToDB, sendWhatsAppToUser } from "@/lib/juno/delivery"
import { scrapeArxiv, scrapeHackerNews } from "@/lib/juno/scrapers"
import type { RawItem } from "@/lib/juno/types"

function toTechItems(items: RawItem[]): Array<{ title: string; source: string; description: string }> {
  return items.map((t) => ({
    title: t.title,
    source: t.source,
    description: t.description,
  }))
}

// ─── Tech Radar (daily) ──────────────────────────────────────────

export const techRadar = inngest.createFunction(
  {
    id: "cto-tech-radar",
    name: "CTO: Tech Radar",
    retries: 2,
    triggers: [{ cron: "0 6 * * *" }],
  },
  async ({ step }) => {
    const userIds = await step.run("load-users", getActiveUserIds)

    for (const [i, userId] of userIds.entries()) {
      const context = await step.run(`context-${i}`, () =>
        getCompanyContext(userId, {
          queryHint: "technology stack architecture tools frameworks dependencies",
        }),
      )

      if (!context) continue

      const baseKw = context.extracted.keywords.length > 0 ? context.extracted.keywords : ["AI", "software", "startup"]

      const [arxiv, hn] = await Promise.all([
        step.run(`arxiv-${i}`, () =>
          scrapeArxiv([...baseKw, "language model", "transformer", "agent"]),
        ),
        step.run(`hn-${i}`, () => scrapeHackerNews([...baseKw, "AI", "LLM", "typescript", "nextjs"])),
      ])

      const allTech = [...arxiv, ...hn]
      if (allTech.length === 0) continue

      const analysis = await step.run(`analyze-${i}`, () =>
        analyzeTechTrends({
          context,
          items: toTechItems(allTech.slice(0, 20)),
        }),
      )

      await step.run(`save-radar-${i}`, async () => {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
          console.warn("[CTO techRadar] missing Supabase env — skipping ai_outputs insert")
          return
        }
        const { supabaseAdmin } = await import("@/lib/supabase")
        const { error } = await supabaseAdmin.from("ai_outputs").insert({
          user_id: userId,
          type: "tech_radar",
          content: {
            trends: analysis.trends,
            postSuggestions: analysis.postSuggestions,
            sourcesScanned: allTech.length,
          },
          metadata: { generated_at: new Date().toISOString() },
        })
        if (error) console.error("[CTO techRadar] ai_outputs insert:", error.message)
      })

      for (const [si, suggestion] of (analysis.postSuggestions || []).entries()) {
        await step.run(`post-suggestion-${i}-${si}`, () =>
          saveContentToDB({
            userId,
            platform: "technical",
            contentType: "post_suggestion",
            body: suggestion,
            status: "draft",
          }),
        )
      }

      if (analysis.trends?.length > 0) {
        await step.run(`notify-${i}`, async () => {
          const msg = [
            `🔬 *Tech Radar*`,
            "",
            ...analysis.trends.slice(0, 3).map(
              (t) => `• *${t.trend}*\n  ${t.relevance}\n  → ${t.action}`,
            ),
          ].join("\n")
          const r = await sendWhatsAppToUser(userId, msg)
          if (!r.success) {
            console.log("[CTO techRadar] trends (no verified WhatsApp):", analysis.trends?.slice(0, 2))
          }
        })
      }
    }

    return { users: userIds.length }
  },
)

// ─── Platform Poster (after approval) ────────────────────────────

export const platformPoster = inngest.createFunction(
  {
    id: "cto-platform-poster",
    name: "CTO: Platform Poster",
    retries: 1,
    triggers: [{ event: "juno/content.approved" }],
  },
  async ({ event, step }) => {
    const data = event.data as {
      platform?: string
      contentId?: string
      [key: string]: unknown
    }

    if (data.platform !== "technical") {
      return { skipped: true as const }
    }

    const contentId = data.contentId
    if (!contentId) {
      console.warn("[CTO platformPoster] missing contentId")
      return { skipped: true as const, reason: "no_content_id" }
    }

    await step.run("mark-ready", async () => {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("[CTO platformPoster] no service role")
        return
      }
      const { supabaseAdmin } = await import("@/lib/supabase")
      const { error } = await supabaseAdmin
        .from("ai_outputs")
        .update({
          content: { ...data, status: "ready_to_post" },
        })
        .eq("id", contentId)

      if (error) console.error("[CTO platformPoster] update:", error.message)
    })

    return { status: "ready_to_post" as const }
  },
)

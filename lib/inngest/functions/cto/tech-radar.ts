import { inngest } from "@/lib/inngest/client"
import { getActiveUserIds, getCompanyContext } from "@/lib/company-context"
import { analyzeTechTrends } from "@/lib/juno/ai-engine"
import { insertContentCalendarRow } from "@/lib/content-calendar"
import { saveContentToDB } from "@/lib/juno/delivery"
import {
  dedupeByUrl,
  filterToLast24Hours,
  scrapeArxiv,
  scrapeCTOSources,
  scrapeHackerNews,
} from "@/lib/juno/scrapers"
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

      const [ctoItems, arxiv, hn] = await Promise.all([
        step.run(`scrape-cto-rss-${i}`, () => scrapeCTOSources(baseKw)),
        step.run(`arxiv-${i}`, () =>
          scrapeArxiv([...baseKw, "language model", "transformer", "agent"]),
        ),
        step.run(`hn-${i}`, () => scrapeHackerNews([...baseKw, "AI", "LLM", "typescript", "nextjs"])),
      ])

      const allTech = filterToLast24Hours(dedupeByUrl([...ctoItems, ...arxiv, ...hn]))
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
        const dateStr = new Date().toISOString().slice(0, 10)
        const trends = analysis.trends || []
        const mdPreview = trends
          .slice(0, 5)
          .map((t) => `## ${t.trend}\n${t.relevance}\n→ ${t.action}`)
          .join("\n\n")
        const { error } = await supabaseAdmin.from("ai_outputs").insert({
          user_id: userId,
          tool: "tech_radar",
          title: `Tech radar — ${dateStr}`,
          output: mdPreview || `Tech radar — ${dateStr} (${allTech.length} sources scanned)`,
          inputs: {
            trends: analysis.trends,
            postSuggestions: analysis.postSuggestions,
            sourcesScanned: allTech.length,
          },
          metadata: { generated_at: new Date().toISOString() },
        })
        if (error) console.error("[CTO techRadar] ai_outputs insert:", error.message)
      })

      await step.run(`write-tech-radar-vault-${i}`, async () => {
        const { writeVaultFile } = await import("@/lib/juno/vault")
        const date = new Date().toISOString().split("T")[0]
        const trends = analysis.trends || []
        const md = [
          `---`,
          `date: ${date}`,
          `type: tech-radar`,
          `sources_scanned: ${allTech.length}`,
          `---`,
          ``,
          `# Tech radar — ${date}`,
          ``,
          ...trends.map((t) => `## ${t.trend}\n\n${t.relevance}\n\n→ **Action:** ${t.action}\n`),
        ].join("\n")
        const r = await writeVaultFile(`juno/tech-radar/${date}.md`, md, `Juno: Tech radar ${date}`, userId)
        if (!r.success && r.error) {
          console.warn("[CTO techRadar] vault write:", r.error)
        }
      })

      for (const [si, suggestion] of (analysis.postSuggestions || []).entries()) {
        await step.run(`post-suggestion-${i}-${si}`, async () => {
          const cId = await saveContentToDB({
            userId,
            platform: "technical",
            contentType: "post_suggestion",
            body: suggestion,
            status: "draft",
          })
          await insertContentCalendarRow({
            userId,
            title: suggestion.slice(0, 200),
            body: suggestion,
            channel: "hn",
            contentType: "post",
            scheduledDate: null,
            source: "cto_radar",
            sourceRef: cId ?? undefined,
          })
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
      const { data: row, error: fetchErr } = await supabaseAdmin
        .from("ai_outputs")
        .select("inputs")
        .eq("id", contentId)
        .single()

      if (fetchErr) {
        console.error("[CTO platformPoster] load row:", fetchErr.message)
        return
      }

      const prev = (row?.inputs as Record<string, unknown> | null) ?? {}
      const { error } = await supabaseAdmin
        .from("ai_outputs")
        .update({
          inputs: { ...prev, status: "ready_to_post" },
        })
        .eq("id", contentId)

      if (error) console.error("[CTO platformPoster] update:", error.message)
    })

    return { status: "ready_to_post" as const }
  },
)

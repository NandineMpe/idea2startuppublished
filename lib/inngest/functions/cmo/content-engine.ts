import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import { inngest } from "@/lib/inngest/client"
import { getCompanyContextForJobs } from "@/lib/company-context-admin"
import type { DailyBriefPayload } from "@/lib/juno/types"

/**
 * Listens for scored brief → drafts LinkedIn post + comment ideas → queues approval (WhatsApp stub).
 */
export const contentEngine = inngest.createFunction(
  {
    id: "juno-cmo-content-engine",
    name: "CMO · Content engine (brief.generated)",
    triggers: [{ event: "juno/brief.generated" }],
  },
  async ({ event, step }) => {
    const data = event.data as DailyBriefPayload
    const { userId, briefMarkdown } = data

    const companyContext = await step.run("context", () => getCompanyContextForJobs(userId))

    const drafts = await step.run("draft-linkedin", async () => {
      if (!process.env.ANTHROPIC_API_KEY) {
        return {
          linkedinPost: "Stub LinkedIn post — set ANTHROPIC_API_KEY",
          commentIdeas: "Stub comment ideas",
        }
      }
      const post = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        maxTokens: 1200,
        system:
          "You are the CMO. Write ONE LinkedIn post (under 2200 chars), professional, based on the daily brief.",
        prompt: `Company:\n${companyContext.slice(0, 8000)}\n\nDaily brief:\n${briefMarkdown.slice(0, 12000)}`,
      })
      const comments = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        maxTokens: 600,
        system: "Give 3 very short comment ideas (one line each) for engaging on others' posts this week.",
        prompt: `Brief:\n${briefMarkdown.slice(0, 6000)}`,
      })
      return { linkedinPost: post.text, commentIdeas: comments.text }
    })

    await step.run("queue-approval-stub", async () => {
      console.log("[juno/cmo] content.ready — approve for LinkedIn (stub):", drafts.linkedinPost?.slice(0, 200))
      return { queued: true }
    })

    await step.sendEvent("content-ready", {
      name: "juno/content.ready",
      data: {
        userId,
        linkedinDraft: drafts.linkedinPost,
        sourceBrief: briefMarkdown.slice(0, 500),
      },
    })

    return { ok: true, userId }
  },
)

import { generateObject } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { z } from "zod"
import { NO_EM_DASH_RULE, stripEmDashesDeep } from "@/lib/creator/text"

/**
 * Creator OS Claude helper. Separate from the careeros helper because agent
 * synthesis runs on claude-opus-5, which rejects the `temperature` parameter
 * the careeros helper always sends.
 */
export const CREATOR_MODEL_NAME = "claude-opus-5"
export const CREATOR_MODEL_VERSION = "creator-claude-v1"

export function creatorClaudeModel() {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY")
  return createAnthropic({ apiKey: key })(CREATOR_MODEL_NAME)
}

export async function creatorGenerateObject<TSchema extends z.ZodType>(args: {
  schema: TSchema
  system: string
  prompt: string
  maxOutputTokens?: number
}): Promise<{
  object: z.infer<TSchema>
  usage: { totalTokens: number }
}> {
  try {
    const result = await generateObject({
      model: creatorClaudeModel(),
      schema: args.schema,
      // Appended to every system prompt rather than repeated per agent: the
      // sanitiser below guarantees the result, but prose written without them
      // reads better than prose repaired afterwards.
      system: `${args.system}\n\n${NO_EM_DASH_RULE}`,
      prompt: args.prompt,
      // Generous by default: this model thinks, and thinking is charged against
      // the same ceiling as the response, so a tight budget truncates the JSON
      // mid-object and surfaces as an unhelpful schema-mismatch error.
      maxOutputTokens: args.maxOutputTokens ?? 16000,
    })

    return {
      // Enforced at the single chokepoint every generation passes through, so
      // no caller can forget it and no new agent can reintroduce them.
      object: stripEmDashesDeep(result.object),
      usage: { totalTokens: result.usage?.totalTokens ?? 0 },
    }
  } catch (e) {
    // "response did not match schema" names neither the offending field nor the
    // reason, and the value it echoes is long enough to bury both. Surface the
    // Zod issue paths instead — that is the part that identifies the fix.
    const err = e as {
      message?: string
      cause?: { message?: string; issues?: Array<{ path?: Array<string | number>; message?: string }> }
    }

    const issues = err.cause?.issues
    if (Array.isArray(issues) && issues.length) {
      const summary = issues
        .slice(0, 8)
        .map((i) => `${(i.path ?? []).join(".") || "(root)"}: ${i.message ?? "invalid"}`)
        .join("; ")
      throw new Error(`Schema mismatch — ${summary}`)
    }

    throw new Error(err.message ?? String(e))
  }
}

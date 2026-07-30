import { generateObject } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { z } from "zod"

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
      system: args.system,
      prompt: args.prompt,
      // Generous by default: this model thinks, and thinking is charged against
      // the same ceiling as the response, so a tight budget truncates the JSON
      // mid-object and surfaces as an unhelpful schema-mismatch error.
      maxOutputTokens: args.maxOutputTokens ?? 16000,
    })

    return {
      object: result.object,
      usage: { totalTokens: result.usage?.totalTokens ?? 0 },
    }
  } catch (e) {
    // The SDK's default message ("response did not match schema") says nothing
    // about which field failed or what the model actually returned, which makes
    // these failures far more expensive to diagnose than they need to be.
    const err = e as { message?: string; text?: string; cause?: { message?: string } }
    const detail = [err.cause?.message, err.text ? `raw: ${err.text.slice(0, 400)}` : null]
      .filter(Boolean)
      .join(" | ")
    throw new Error(detail ? `${err.message ?? "generateObject failed"} — ${detail}` : String(err.message ?? e))
  }
}

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
  const result = await generateObject({
    model: creatorClaudeModel(),
    schema: args.schema,
    system: args.system,
    prompt: args.prompt,
    maxOutputTokens: args.maxOutputTokens ?? 8000,
  })

  return {
    object: result.object,
    usage: { totalTokens: result.usage?.totalTokens ?? 0 },
  }
}

import { generateObject, generateText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { z } from "zod"

export const CLAUDE_MODEL_NAME = "claude-sonnet-4-6"
export const CLAUDE_MODEL_VERSION = "careeros-claude-v1"

export function getAnthropicApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY?.trim() || null
}

export function claudeModel() {
  const key = getAnthropicApiKey()
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY")
  return createAnthropic({ apiKey: key })(CLAUDE_MODEL_NAME)
}

export async function claudeGenerateObject<TSchema extends z.ZodType>(args: {
  schema: TSchema
  system: string
  prompt: string
  maxOutputTokens?: number
}): Promise<{
  object: z.infer<TSchema>
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}> {
  const result = await generateObject({
    model: claudeModel(),
    schema: args.schema,
    system: args.system,
    prompt: args.prompt,
    temperature: 0.1,
    maxOutputTokens: args.maxOutputTokens ?? 2000,
  })

  return {
    object: result.object,
    usage: {
      promptTokens: result.usage?.inputTokens ?? 0,
      completionTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    },
  }
}

export async function claudeGenerateText(args: {
  system: string
  prompt: string
  maxOutputTokens?: number
}): Promise<{ text: string; usage: { totalTokens: number } }> {
  const result = await generateText({
    model: claudeModel(),
    system: args.system,
    prompt: args.prompt,
    temperature: 0.1,
    maxOutputTokens: args.maxOutputTokens ?? 2000,
  })
  return {
    text: result.text,
    usage: { totalTokens: result.usage?.totalTokens ?? 0 },
  }
}

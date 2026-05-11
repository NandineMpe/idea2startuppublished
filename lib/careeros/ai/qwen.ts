import { generateObject } from "ai"
import type { z } from "zod"
import { qwenModel, getDefaultModelId } from "@/lib/llm-provider"

export const QWEN_MODEL_NAME = getDefaultModelId()
export const QWEN_MODEL_VERSION = "qwen-module-1-2-v1"

export async function qwenGenerateObject<TSchema extends z.ZodSchema>(args: {
  schema: TSchema
  systemPrompt: string
  userPrompt: string
}): Promise<{
  object: z.infer<TSchema>
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}> {
  const result = await generateObject({
    model: qwenModel(),
    schema: args.schema,
    system: args.systemPrompt,
    prompt: args.userPrompt,
    temperature: 0.1,
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

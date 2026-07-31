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

/**
 * Recover an object the model buried one level down.
 *
 * Tries the parsed JSON as-is first, then any single-key wrapper. Only a lone
 * key is unwrapped, so this cannot silently pick one branch out of a response
 * that genuinely had several.
 */
function unwrapEnvelope<TSchema extends z.ZodType>(
  rawText: string,
  schema: TSchema,
): z.infer<TSchema> | undefined {
  if (!rawText.trim().startsWith("{")) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== "object") return undefined

  const direct = schema.safeParse(parsed)
  if (direct.success) return direct.data

  const keys = Object.keys(parsed as Record<string, unknown>)
  if (keys.length !== 1) return undefined

  const inner = schema.safeParse((parsed as Record<string, unknown>)[keys[0]])
  return inner.success ? inner.data : undefined
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
      text?: string
      finishReason?: string
      cause?: {
        message?: string
        text?: string
        issues?: Array<{ path?: Array<string | number>; message?: string }>
      }
    }

    const issues = err.cause?.issues
    if (Array.isArray(issues) && issues.length) {
      const summary = issues
        .slice(0, 8)
        .map((i) => `${(i.path ?? []).join(".") || "(root)"}: ${i.message ?? "invalid"}`)
        .join("; ")
      throw new Error(`Schema mismatch — ${summary}`)
    }

    const rawText = err.text ?? err.cause?.text ?? ""

    // The model sometimes wraps the whole object in a single-key envelope. The
    // key is not stable: the same prompt produced {"value": ...} on one attempt
    // and {"response": ...} on the next, which is why this matches the SHAPE
    // rather than a list of names. The content inside is complete and valid,
    // the finish reason is "stop", and it fails only on the wrapper, so losing
    // an entire generation to it would be pure waste.
    const recovered = unwrapEnvelope(rawText, args.schema)
    if (recovered !== undefined) {
      return {
        object: stripEmDashesDeep(recovered),
        // Usage is not carried on the error, and inventing a number would be
        // worse than reporting none.
        usage: { totalTokens: 0 },
      }
    }

    // No issues means nothing parseable came back at all, which is a different
    // failure from a field being wrong: the model answered in prose, refused,
    // or stopped early. The generic message hides which, and they need
    // different fixes, so the raw beginning of the response goes in the error.
    const raw = rawText.replace(/\s+/g, " ").trim()
    if (raw) {
      throw new Error(
        `No object generated (finish: ${err.finishReason ?? "unknown"}) — model said: "${raw.slice(0, 400)}"`,
      )
    }

    throw new Error(err.message ?? String(e))
  }
}

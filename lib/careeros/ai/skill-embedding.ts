/**
 * OpenAI text-embedding-3-small @ 1536 — CareerOS skill graph (Module 1.4).
 * Uses dedicated API key so DashScope/Qwen stays separate from embedding billing.
 */

export const SKILL_EMBEDDING_MODEL = "text-embedding-3-small"
export const SKILL_EMBEDDING_DIM = 1536
/** Bump when input text formula or model changes (re-embedding strategy). */
export const SKILL_EMBEDDING_VERSION = "text-embedding-3-small-careeros-v1"

export function getOpenAiEmbeddingApiKey(): string | null {
  const k =
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.CAREEROS_OPENAI_EMBEDDING_KEY?.trim()
  return k || null
}

export function buildSkillEmbeddingInput(args: {
  skill_name: string
  source_type?: string | null
  evidence_payload?: unknown
  onet_skill_id?: string | null
}): string {
  let evidence = ""
  const ep = args.evidence_payload
  if (ep && typeof ep === "object" && ep !== null && "evidence" in ep) {
    evidence = String((ep as { evidence?: unknown }).evidence ?? "").trim()
  }
  const lines = [
    `Skill: ${args.skill_name.trim()}`,
    args.source_type ? `Source: ${args.source_type}` : "",
    evidence ? `Evidence: ${evidence.slice(0, 600)}` : "",
    args.onet_skill_id?.trim() ? `O*NET element id: ${args.onet_skill_id.trim()}` : "",
  ].filter(Boolean)
  return lines.join("\n")
}

/** Format for pgvector / Supabase PostgREST insert. */
export function formatVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`
}

export async function embedSkillInputText(input: string): Promise<number[]> {
  const apiKey = getOpenAiEmbeddingApiKey()
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY (or CAREEROS_OPENAI_EMBEDDING_KEY) for skill embeddings")
  }

  const body = {
    model: SKILL_EMBEDDING_MODEL,
    input: input.slice(0, 8000),
    dimensions: SKILL_EMBEDDING_DIM,
  }

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const raw = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>
    error?: { message?: string }
  }

  if (!res.ok) {
    throw new Error(raw.error?.message ?? `OpenAI embeddings HTTP ${res.status}`)
  }

  const vec = raw.data?.[0]?.embedding
  if (!vec || !Array.isArray(vec) || vec.length !== SKILL_EMBEDDING_DIM) {
    throw new Error(`Unexpected embedding shape (expected ${SKILL_EMBEDDING_DIM} dims)`)
  }

  return vec
}

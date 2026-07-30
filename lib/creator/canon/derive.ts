import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { percentile } from "@/lib/creator/load-worth"
import { confidenceForSample } from "@/lib/creator/types"

/**
 * Canon derivation: who the creator is, computed from what they actually
 * published. Claude does the qualitative clustering (pillars, formats, voice,
 * topics, per-post assignment); every number (counts, medians, shares) is
 * computed here in code from real metrics — the model never invents a figure.
 */

export const CANON_PROMPT_VERSION = "creator-canon-v1"

const MAX_POSTS_IN_PROMPT = 100

const derivationSchema = z.object({
  pillars: z.array(z.object({
    label: z.string(),
    description: z.string(),
    post_indexes: z.array(z.number().int()),
  })).max(6),
  formats: z.array(z.object({
    label: z.string(),
    structure: z.array(z.string()).describe('Ordered beats, e.g. ["contrarian open", "receipt", "turn"].'),
    post_indexes: z.array(z.number().int()),
  })).max(8),
  voice: z.object({
    openers: z.array(z.string()),
    rhythm_notes: z.array(z.string()),
    vocabulary: z.array(z.string()),
    never_says: z.array(z.string()),
  }).nullable().describe("Null when there is too little spoken/caption text to read a voice."),
  topics: z.array(z.object({
    label: z.string(),
    weight: z.number().min(0).max(1),
    adjacent: z.array(z.string()),
  })).max(12),
})

const SYSTEM_PROMPT = `You are the editorial director of a one-person creator's management agency, deriving the creator's canon from their actual published work — never from what a bio would claim.

Rules:
- Pillars are clusters of what they actually make. Every post index belongs to at most one pillar. Do not invent pillars a post list doesn't support.
- Formats are repeatable STRUCTURES they return to (how a post is built), independent of topic. A format needs at least 2 posts to exist.
- Voice comes from transcripts first, captions second. never_says (what they demonstrably avoid) matters more than the positive patterns. Return null voice rather than a generic one.
- Topic weights reflect share of the corpus and must sum to roughly 1. "adjacent" = topics one step away that they have NOT worked — the stretch surface.
- Post indexes refer to the numbered list. Never reference an index that does not exist.`

type PostRow = {
  id: string
  caption: string | null
  transcript: string | null
  posted_at: string
  metrics: { views?: number } | null
}

function slugify(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)
}

function medianViews(posts: PostRow[]): number | null {
  const views = posts
    .map((p) => p.metrics?.views)
    .filter((v): v is number => typeof v === "number" && v >= 0)
    .sort((a, b) => a - b)
  return views.length ? Math.round(percentile(views, 0.5)) : null
}

export type CanonDeriveResult = {
  version: number
  corpus_size: number
  pillars: number
  formats: number
  tokens: number
}

export async function deriveCanonForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<CanonDeriveResult | null> {
  const { data: postsData, error: postsError } = await supabase
    .schema("creator")
    .from("creator_content")
    .select("id,caption,transcript,posted_at,metrics")
    .eq("user_id", userId)
    .order("posted_at", { ascending: false })
    .limit(MAX_POSTS_IN_PROMPT)
  if (postsError) throw postsError

  const posts = (postsData ?? []) as PostRow[]
  if (posts.length < 3) return null

  const postList = posts
    .map((p, i) => {
      const views = typeof p.metrics?.views === "number" ? `${p.metrics.views} views` : "no metrics"
      const text = p.transcript
        ? `transcript: ${p.transcript.slice(0, 320)}`
        : p.caption
          ? `caption: ${p.caption.slice(0, 200)}`
          : "no text"
      return `[${i}] ${p.posted_at.slice(0, 10)} · ${views} · ${text}`
    })
    .join("\n")

  const { object, usage } = await creatorGenerateObject({
    schema: derivationSchema,
    system: SYSTEM_PROMPT,
    prompt: `THE CREATOR'S PUBLISHED POSTS (numbered, newest first):\n${postList}\n\nDerive the canon.`,
    maxOutputTokens: 8000,
  })

  const validIndex = (i: number) => i >= 0 && i < posts.length

  const pillars = object.pillars.map((pillar) => {
    const members = pillar.post_indexes.filter(validIndex).map((i) => posts[i])
    return {
      id: slugify(pillar.label),
      label: pillar.label,
      description: pillar.description,
      post_count: members.length,
      median_views: medianViews(members),
      share_of_output: posts.length ? members.length / posts.length : 0,
      post_indexes: pillar.post_indexes.filter(validIndex),
    }
  })

  const formats = object.formats
    .map((format) => {
      const members = format.post_indexes.filter(validIndex).map((i) => posts[i])
      return {
        id: slugify(format.label),
        label: format.label,
        structure: format.structure,
        post_count: members.length,
        median_views: medianViews(members),
        trend: "unknown" as const,
        post_indexes: format.post_indexes.filter(validIndex),
      }
    })
    .filter((f) => f.post_count >= 2)

  const { data: latest } = await supabase
    .schema("creator")
    .from("creator_canon")
    .select("version")
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  const version = (latest?.version ?? 0) + 1

  const { error: canonError } = await supabase
    .schema("creator")
    .from("creator_canon")
    .insert({
      user_id: userId,
      version,
      corpus_size: posts.length,
      confidence: confidenceForSample(posts.length),
      pillars: pillars.map(({ post_indexes: _drop, ...pillar }) => pillar),
      formats: formats.map(({ post_indexes: _drop, ...format }) => format),
      voice: object.voice,
      topics: object.topics,
      model_version: CREATOR_MODEL_VERSION,
      prompt_version: CANON_PROMPT_VERSION,
    })
  if (canonError) throw canonError

  // Stamp assignments back onto the corpus so Worth can slice by pillar/format.
  const pillarByPost = new Map<string, string>()
  for (const pillar of pillars) {
    for (const i of pillar.post_indexes) pillarByPost.set(posts[i].id, pillar.id)
  }
  const formatByPost = new Map<string, string>()
  for (const format of formats) {
    for (const i of format.post_indexes) formatByPost.set(posts[i].id, format.id)
  }
  for (const post of posts) {
    const pillarId = pillarByPost.get(post.id) ?? null
    const formatId = formatByPost.get(post.id) ?? null
    if (!pillarId && !formatId) continue
    const { error } = await supabase
      .schema("creator")
      .from("creator_content")
      .update({ pillar_id: pillarId, format_id: formatId })
      .eq("id", post.id)
    if (error) throw error
  }

  return {
    version,
    corpus_size: posts.length,
    pillars: pillars.length,
    formats: formats.length,
    tokens: usage.totalTokens,
  }
}

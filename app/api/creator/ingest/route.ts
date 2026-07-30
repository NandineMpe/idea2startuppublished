import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendCreatorEvent } from "@/lib/creator/inngest/client"
import type { NormalisedPost } from "@/lib/creator/ingest/normalise"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_POSTS_PER_REQUEST = 500

/**
 * Corpus import endpoint. The client normalises (adapter parsing happens in
 * the browser); this route authenticates, upserts under RLS, and kicks the
 * pipeline: transcription for rows that arrived without a transcript, and a
 * canon (re)derivation once the corpus has changed.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: { posts?: NormalisedPost[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const posts = Array.isArray(body.posts) ? body.posts.slice(0, MAX_POSTS_PER_REQUEST) : []
  if (!posts.length) return NextResponse.json({ error: "No posts in payload" }, { status: 400 })

  const rows = posts
    .filter((p) => p && typeof p.external_id === "string" && typeof p.posted_at === "string")
    .map((p) => ({
      user_id: user.id,
      platform: "tiktok",
      external_id: p.external_id,
      url: p.url,
      caption: p.caption,
      transcript: p.transcript,
      transcript_status: p.transcript ? "done" : "pending",
      posted_at: p.posted_at,
      duration_seconds: p.duration_seconds,
      metrics: p.metrics,
      metrics_captured_at: p.metrics ? new Date().toISOString() : null,
      source_adapter: p.source_adapter ?? "manual",
      raw_payload: p.raw_payload ?? {},
    }))

  const { data: inserted, error } = await supabase
    .schema("creator")
    .from("creator_content")
    .upsert(rows, { onConflict: "user_id,platform,external_id", ignoreDuplicates: true })
    .select("id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contentIds = (inserted ?? []).map((row) => row.id as string)

  // Kick the pipeline. Failures here must not fail the import — the crons pick
  // stragglers up on their next pass.
  try {
    if (contentIds.length) {
      await sendCreatorEvent({
        name: "creator/corpus.ingested",
        data: { user_id: user.id, content_ids: contentIds },
      })
    }
  } catch (e) {
    console.warn("[creator-ingest] event send failed:", e instanceof Error ? e.message : e)
  }

  return NextResponse.json({ imported: contentIds.length, received: rows.length })
}

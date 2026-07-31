import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { loadFeedPage, type FeedFilter } from "@/lib/creator/load-feed"
import { expandCreatorSeed } from "@/lib/creator/research/expand"

export const runtime = "nodejs"
// POST works a document into a dossier inline, which is a full research pass.
export const maxDuration = 300

const FILTERS: FeedFilter[] = ["all", "primary", "considered", "unseen", "used"]

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const url = new URL(request.url)
  const filterRaw = url.searchParams.get("filter")
  const filter = FILTERS.includes(filterRaw as FeedFilter) ? (filterRaw as FeedFilter) : "all"

  const page = await loadFeedPage(supabase, user.id, {
    filter,
    lane: url.searchParams.get("lane") ?? undefined,
    cursor: url.searchParams.get("cursor"),
  })

  return NextResponse.json(page)
}

/**
 * Work one document into a dossier.
 *
 * The seed is built from the signal rather than typed, so the pass starts from
 * the primary document the creator pointed at instead of from a paraphrase of
 * it. Everything else is the existing seeded-story path, including its refusal
 * to assemble a thesis the sources do not support.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: { signal_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.signal_id) return NextResponse.json({ error: "No signal given" }, { status: 400 })

  const { data: signal } = await supabase
    .schema("creator")
    .from("creator_signals")
    .select("id,title,snippet,url,lane")
    .eq("id", body.signal_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!signal) return NextResponse.json({ error: "Document not found" }, { status: 404 })

  const seed = [
    signal.title,
    signal.snippet ? String(signal.snippet).slice(0, 600) : "",
    signal.url ? `Source: ${signal.url}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const result = await expandCreatorSeed(supabase, user.id, seed)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  // The creator chose this one, which is a stronger signal of use than
  // synthesis citing it, so it leaves the unread pile either way.
  await supabase
    .schema("creator")
    .from("creator_signals")
    .update({ used_at: new Date().toISOString(), considered_at: new Date().toISOString() })
    .eq("id", signal.id)
    .eq("user_id", user.id)

  return NextResponse.json({ verdict: result.verdict, receipts: result.receipts })
}

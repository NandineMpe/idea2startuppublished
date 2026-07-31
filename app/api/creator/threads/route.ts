import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { openThreadsFromCorpus } from "@/lib/creator/threads/open"
import { checkThread, loadDueThreads } from "@/lib/creator/threads/check"

export const runtime = "nodejs"
// Inline rather than queued: both actions are things the creator asked for and
// is watching, and a check across eleven primary lanes is not quick.
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: { action?: string; thread_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body.action === "open") {
    const result = await openThreadsFromCorpus(supabase, user.id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ opened: result.opened })
  }

  if (body.action === "check") {
    // A single named thread, or the ones that are due. Checking everything at
    // once would blow the execution window and is never what is wanted.
    const threads = body.thread_id
      ? await (async () => {
          const { data } = await supabase
            .schema("creator")
            .from("creator_threads")
            .select("id,subject,query,anchor_date,what_was_known,open_questions,developments,check_count")
            .eq("id", body.thread_id!)
            .eq("user_id", user.id)
            .maybeSingle()
          return data ? [data] : []
        })()
      : await loadDueThreads(supabase, user.id, 3)

    if (!threads.length) {
      return NextResponse.json({ checked: 0, moved: 0, note: "Nothing due." })
    }

    let moved = 0
    for (const thread of threads) {
      const result = await checkThread(supabase, user.id, thread)
      if (result.ok && result.moved) moved++
    }
    return NextResponse.json({ checked: threads.length, moved })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

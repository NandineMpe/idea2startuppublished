import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { inngest } from "@/lib/inngest/client"
import { TODO_RESEARCH_REQUESTED } from "@/lib/inngest/event-names"
import { jsonApiError } from "@/lib/api-error-response"

/** POST /api/todo-research — trigger research for a todo item */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json({ error: "INNGEST_EVENT_KEY not set." }, { status: 501 })
  }

  let todoId = ""
  let todoText = ""
  try {
    const body = (await req.json()) as { todoId?: string; todoText?: string }
    todoId = typeof body.todoId === "string" ? body.todoId.trim() : ""
    todoText = typeof body.todoText === "string" ? body.todoText.trim().slice(0, 500) : ""
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  if (!todoId || !todoText) {
    return NextResponse.json({ error: "todoId and todoText are required" }, { status: 400 })
  }

  // Insert a pending record immediately so the UI can poll
  const researchId = `research-${todoId}`
  await supabase.from("todo_research").upsert({
    id: researchId,
    user_id: auth.user.id,
    todo_id: todoId,
    todo_text: todoText,
    status: "pending",
  })

  try {
    await inngest.send({
      name: TODO_RESEARCH_REQUESTED,
      data: { userId: auth.user.id, todoId, todoText },
    })
    return NextResponse.json({ ok: true, researchId })
  } catch (e) {
    return jsonApiError(503, e, "todo-research POST")
  }
}

/** GET /api/todo-research?todoId=... — poll for research results */
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const todoId = searchParams.get("todoId")
  if (!todoId) return NextResponse.json({ error: "todoId required" }, { status: 400 })

  const { data, error } = await supabase
    .from("todo_research")
    .select("id, status, summary, key_findings, action_items, sources, completed_at")
    .eq("user_id", auth.user.id)
    .eq("todo_id", todoId)
    .maybeSingle()

  if (error) {
    const msg = (error.message ?? "").toLowerCase()
    if (msg.includes("does not exist") || msg.includes("schema cache")) {
      return NextResponse.json({ research: null })
    }
    return jsonApiError(500, error, "todo-research GET")
  }

  return NextResponse.json({ research: data ?? null })
}

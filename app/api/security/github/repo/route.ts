import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** Persist selected GitHub repo + branch for security scans (Pipedream → GitHub API). */
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    github_repo?: string
    github_branch?: string
  }

  const repo = body.github_repo?.trim()
  if (!repo) {
    return NextResponse.json({ error: "github_repo is required (owner/repo)." }, { status: 400 })
  }

  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) {
    return NextResponse.json({ error: "Invalid repo format. Use owner/repo." }, { status: 400 })
  }

  const branch = (body.github_branch?.trim() || "main").slice(0, 200)

  const { data: existing, error: fetchErr } = await supabase
    .from("company_profile")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (fetchErr) {
    console.error("[security/github/repo]", fetchErr.message)
    return NextResponse.json({ error: "Could not load profile." }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json(
      { error: "Add your company profile under Context first, then select a repo here." },
      { status: 422 },
    )
  }

  const { error: upErr } = await supabase
    .from("company_profile")
    .update({
      github_repo: repo,
      github_branch: branch,
    })
    .eq("user_id", user.id)

  if (upErr) {
    console.error("[security/github/repo] update", upErr.message)
    return NextResponse.json({ error: "Could not save repo selection." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, github_repo: repo, github_branch: branch })
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationSelection } from "@/lib/organizations"

/** Persist selected GitHub repo + branch for security scans (GitHub API via GITHUB_PAT). */
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

  const parts = repo.split("/").filter(Boolean)
  if (parts.length !== 2 || parts[0].length > 200 || parts[1].length > 200) {
    return NextResponse.json(
      { error: "Use two segments: owner/repo (e.g. your-org/your-repo)." },
      { status: 400 },
    )
  }

  const branch = (body.github_branch?.trim() || "main").slice(0, 200)

  const organization = await resolveOrganizationSelection(user.id, { useCookieOrganization: true })
  if (!organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 })
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("company_profile")
    .select("id")
    .eq("organization_id", organization.id)
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
    .eq("organization_id", organization.id)

  if (upErr) {
    console.error("[security/github/repo] update", upErr.message)
    return NextResponse.json({ error: "Could not save repo selection." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, github_repo: repo, github_branch: branch })
}

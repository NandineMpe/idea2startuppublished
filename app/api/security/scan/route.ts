import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { inngest } from "@/lib/inngest/client"
import { resolveGithubRepoFromProfile } from "@/lib/juno/security-scan-profile"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("company_profile")
    .select("github_repo, github_branch, github_vault_owner, github_vault_repo, github_vault_branch")
    .eq("user_id", user.id)
    .maybeSingle()

  const resolved = profile
    ? resolveGithubRepoFromProfile({
        github_repo: profile.github_repo as string | null,
        github_branch: profile.github_branch as string | null,
        github_vault_owner: profile.github_vault_owner as string | null,
        github_vault_repo: profile.github_vault_repo as string | null,
        github_vault_branch: profile.github_vault_branch as string | null,
      })
    : null

  if (!resolved) {
    return NextResponse.json(
      {
        error:
          "No GitHub repo configured. Set owner/repo under company profile (github_repo) or connect your Obsidian vault repo.",
      },
      { status: 400 },
    )
  }

  const body = (await req.json().catch(() => ({}))) as { mode?: "daily" | "comprehensive" }
  const mode = body.mode === "comprehensive" ? "comprehensive" : "daily"

  try {
    await inngest.send({
      name: "juno/security-scan.requested",
      data: {
        userId: user.id,
        repo: resolved.repo,
        branch: resolved.branch,
        mode,
      },
    })
  } catch (e) {
    console.error("[api/security/scan]", e)
    return NextResponse.json(
      { error: "Could not queue scan. Set INNGEST_EVENT_KEY for server-triggered Inngest events." },
      { status: 503 },
    )
  }

  return NextResponse.json({ triggered: true, repo: resolved.repo, branch: resolved.branch, mode })
}

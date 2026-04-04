import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { JUNO_SECURITY_SCAN_REQUESTED } from "@/lib/inngest/event-names"
import { inngest } from "@/lib/inngest/client"
import { resolveGithubRepoFromProfile } from "@/lib/juno/security-scan-profile"
import { resolveOrganizationSelection } from "@/lib/organizations"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const organization = await resolveOrganizationSelection(user.id, { useCookieOrganization: true })
  const { data: profile } = organization
    ? await supabase
        .from("company_profile")
        .select("github_repo, github_branch, github_vault_owner, github_vault_repo, github_vault_branch")
        .eq("organization_id", organization.id)
        .maybeSingle()
    : { data: null }

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

  if (!process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json(
      {
        error:
          `INNGEST_EVENT_KEY not set — add from Inngest dashboard (Keys) so the app can send ${JUNO_SECURITY_SCAN_REQUESTED}.`,
      },
      { status: 501 },
    )
  }

  try {
    const { ids } = await inngest.send({
      name: JUNO_SECURITY_SCAN_REQUESTED,
      data: {
        userId: user.id,
        repo: resolved.repo,
        branch: resolved.branch,
        mode,
      },
    })
    return NextResponse.json({
      ok: true,
      triggered: true,
      eventName: JUNO_SECURITY_SCAN_REQUESTED,
      eventIds: ids,
      repo: resolved.repo,
      branch: resolved.branch,
      mode,
    })
  } catch (e) {
    return jsonApiError(503, e, "security scan POST inngest.send")
  }
}

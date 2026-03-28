import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getGithubAccountId,
  githubProxyGetJsonResult,
  githubProxyListUserRepos,
} from "@/lib/juno/pipedream-github"
import { resolveGithubRepoFromProfile } from "@/lib/juno/security-scan-profile"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pipedreamConfigured = Boolean(
    process.env.PIPEDREAM_CLIENT_ID && process.env.PIPEDREAM_CLIENT_SECRET && process.env.PIPEDREAM_PROJECT_ID,
  )

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

  const explicitRepo = (profile?.github_repo as string | null)?.trim() || null

  const accountId = await getGithubAccountId(user.id)
  if (!accountId) {
    return NextResponse.json({
      pipedreamConfigured,
      connected: false,
      githubLogin: null as string | null,
      repos: [] as RepoItem[],
      selectedRepo: resolved?.repo ?? null,
      selectedBranch: resolved?.branch ?? null,
      selectionSource: explicitRepo ? ("explicit" as const) : resolved ? ("vault" as const) : null,
    })
  }

  const [userRes, listRes] = await Promise.all([
    githubProxyGetJsonResult<{ login?: string }>(user.id, accountId, "https://api.github.com/user"),
    githubProxyListUserRepos(user.id, accountId),
  ])

  const githubLogin =
    userRes.ok && userRes.data && typeof (userRes.data as { login?: string }).login === "string"
      ? (userRes.data as { login: string }).login
      : null

  return NextResponse.json({
    pipedreamConfigured,
    connected: true,
    githubLogin,
    repos: listRes.repos,
    reposFetchError: listRes.fetchError ?? null,
    /** True when listing succeeded but returned zero repos (often missing `repo` OAuth scope for private repos). */
    reposEmptyLikelyScope: Boolean(!listRes.fetchError && listRes.repos.length === 0),
    selectedRepo: resolved?.repo ?? null,
    selectedBranch: resolved?.branch ?? null,
    selectionSource: explicitRepo ? ("explicit" as const) : resolved ? ("vault" as const) : null,
  })
}

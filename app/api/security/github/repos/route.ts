import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { githubProxyListUserReposMerged } from "@/lib/juno/pipedream-github"
import { resolveGithubRepoFromProfile } from "@/lib/juno/security-scan-profile"

type RepoItem = { full_name: string; default_branch: string; private: boolean }

/** Pipedream + GitHub proxy can be slow when many accounts are linked. */
export const maxDuration = 60

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

  const vaultOwner = (profile?.github_vault_owner as string | null)?.trim() || null
  const vaultName = (profile?.github_vault_repo as string | null)?.trim() || null
  const vaultRepo = vaultOwner && vaultName ? `${vaultOwner}/${vaultName}` : null
  const vaultBranch = (profile?.github_vault_branch as string | null)?.trim() || "main"

  const merged = await githubProxyListUserReposMerged(user.id)

  const payloadBase = {
    selectedRepo: resolved?.repo ?? null,
    selectedBranch: resolved?.branch ?? null,
    selectionSource: explicitRepo ? ("explicit" as const) : resolved ? ("vault" as const) : null,
    /** From Integrations → Obsidian vault (always returned when owner+repo are set). Use when GitHub list is empty. */
    vaultRepo,
    vaultBranch,
  }

  if (merged.accountIdsTried === 0) {
    return NextResponse.json({
      pipedreamConfigured,
      connected: false,
      githubLogin: null as string | null,
      repos: [] as RepoItem[],
      reposFetchError: merged.fetchError ?? null,
      repoListErrors: merged.repoListErrors ?? [],
      githubAccountsTried: 0,
      reposEmptyLikelyScope: false,
      ...payloadBase,
    })
  }

  return NextResponse.json({
    pipedreamConfigured,
    connected: true,
    githubLogin: merged.githubLogin,
    repos: merged.repos,
    reposFetchError: merged.fetchError ?? null,
    repoListErrors: merged.repoListErrors ?? [],
    githubAccountsTried: merged.accountIdsTried,
    /** True when listing succeeded but returned zero repos (often missing `repo` OAuth scope for private repos). */
    reposEmptyLikelyScope: Boolean(
      !merged.fetchError && merged.repoListErrors.length === 0 && merged.repos.length === 0,
    ),
    ...payloadBase,
  })
}

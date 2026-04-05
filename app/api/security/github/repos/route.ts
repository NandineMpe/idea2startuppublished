import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { splitGithubRepoRef } from "@/lib/github-vault"
import { githubProxyListUserReposForLatestAccount } from "@/lib/juno/pipedream-github"
import { resolveGithubRepoFromProfile } from "@/lib/juno/security-scan-profile"
import { resolveOrganizationSelection } from "@/lib/organizations"

function formatRepoListError(msg: string | undefined | null): string | null {
  if (!msg) return null
  const u = msg.toLowerCase()
  if (u.includes("<html") || u.includes("bad gateway") || /\b502\b/.test(msg)) {
    return "Temporary error from GitHub. Retry in a minute, type owner/repo below, or check GITHUB_PAT on the server."
  }
  if (msg.length > 420) return `${msg.slice(0, 420)}…`
  return msg
}

export const maxDuration = 60

export async function GET() {
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

  const explicitRepo = (profile?.github_repo as string | null)?.trim() || null

  const rawVaultRepo = (profile?.github_vault_repo as string | null)?.trim() || null
  const parsedVaultRepo = splitGithubRepoRef(rawVaultRepo)
  const vaultOwner = (profile?.github_vault_owner as string | null)?.trim() || null
  const vaultRepo =
    parsedVaultRepo
      ? `${parsedVaultRepo.owner}/${parsedVaultRepo.repo}`
      : vaultOwner && rawVaultRepo
        ? `${vaultOwner}/${rawVaultRepo}`
        : rawVaultRepo
  const vaultBranch = (profile?.github_vault_branch as string | null)?.trim() || "main"

  const hasPat = Boolean(process.env.GITHUB_PAT?.trim())
  /** Never list repos via shared `GITHUB_PAT` — that exposes one person's GitHub to every user. */
  const pdRes = await githubProxyListUserReposForLatestAccount(user.id)
  const userLinkedGithub = pdRes.accountIdsTried > 0
  const repos = pdRes.repos

  const payloadBase = {
    selectedRepo: resolved?.repo ?? null,
    selectedBranch: resolved?.branch ?? null,
    selectionSource: explicitRepo ? ("explicit" as const) : resolved ? ("vault" as const) : null,
    vaultRepo,
    vaultBranch,
  }

  let reposFetchError: string | null = null
  if (repos.length === 0 && pdRes.fetchError) {
    if (userLinkedGithub || !hasPat) {
      reposFetchError = formatRepoListError(pdRes.fetchError)
    }
  }

  return NextResponse.json({
    githubConfigured: hasPat || userLinkedGithub,
    connected: userLinkedGithub,
    githubLogin: pdRes.githubLogin,
    repos,
    reposFetchError,
    repoListErrors: pdRes.repoListErrors,
    githubAccountsTried: pdRes.accountIdsTried,
    reposEmptyLikelyScope: Boolean(
      userLinkedGithub && repos.length === 0 && !pdRes.fetchError,
    ),
    reposListedViaPat: false,
    serverPatConfigured: hasPat,
    ...payloadBase,
  })
}

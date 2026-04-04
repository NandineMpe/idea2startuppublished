import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { splitGithubRepoRef } from "@/lib/github-vault"
import { githubProxyListUserReposForLatestAccount } from "@/lib/juno/pipedream-github"
import { listUserReposViaPat } from "@/lib/juno/github-repo"
import { resolveGithubRepoFromProfile } from "@/lib/juno/security-scan-profile"
import { resolveOrganizationSelection } from "@/lib/organizations"

function formatRepoListError(msg: string | undefined | null): string | null {
  if (!msg) return null
  const u = msg.toLowerCase()
  if (u.includes("<html") || u.includes("bad gateway") || /\b502\b/.test(msg)) {
    return "Temporary error from GitHub or the Pipedream proxy (502). Retry in a minute, type owner/repo below, or add GITHUB_PAT on the server for a direct repo list."
  }
  if (msg.length > 420) return `${msg.slice(0, 420)}…`
  return msg
}

type RepoItem = { full_name: string; default_branch: string; private: boolean }

/** Pipedream + GitHub proxy can be slow on large repo lists. */
export const maxDuration = 60

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const organization = await resolveOrganizationSelection(user.id, { useCookieOrganization: true })

  const pipedreamConfigured = Boolean(
    process.env.PIPEDREAM_CLIENT_ID && process.env.PIPEDREAM_CLIENT_SECRET && process.env.PIPEDREAM_PROJECT_ID,
  )

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

  let latest = await githubProxyListUserReposForLatestAccount(user.id)
  let reposListedViaPat = false

  if (latest.repos.length === 0 && process.env.GITHUB_PAT?.trim()) {
    const patRes = await listUserReposViaPat()
    if (patRes.repos.length > 0) {
      latest = {
        ...latest,
        repos: patRes.repos,
        fetchError: undefined,
        repoListErrors: [],
      }
      reposListedViaPat = true
    } else if (patRes.error) {
      console.warn("[security/github/repos] GITHUB_PAT list failed:", patRes.error)
    }
  }

  const payloadBase = {
    selectedRepo: resolved?.repo ?? null,
    selectedBranch: resolved?.branch ?? null,
    selectionSource: explicitRepo ? ("explicit" as const) : resolved ? ("vault" as const) : null,
    /** From Integrations → Obsidian vault (always returned when owner+repo are set). Use when GitHub list is empty. */
    vaultRepo,
    vaultBranch,
  }

  const fetchErr =
    reposListedViaPat || latest.repos.length > 0
      ? null
      : formatRepoListError(latest.fetchError ?? latest.repoListErrors?.[0] ?? null)

  if (latest.accountIdsTried === 0) {
    return NextResponse.json({
      pipedreamConfigured,
      /** True when Pipedream has a linked GitHub account, or when GITHUB_PAT filled the repo list. */
      connected: reposListedViaPat,
      githubLogin: latest.githubLogin,
      repos: latest.repos,
      reposFetchError: fetchErr,
      repoListErrors: latest.repoListErrors ?? [],
      githubAccountsTried: 0,
      reposEmptyLikelyScope: false,
      reposListedViaPat,
      ...payloadBase,
    })
  }

  return NextResponse.json({
    pipedreamConfigured,
    connected: true,
    githubLogin: latest.githubLogin,
    repos: latest.repos,
    reposFetchError: fetchErr,
    repoListErrors: reposListedViaPat ? [] : latest.repoListErrors ?? [],
    githubAccountsTried: latest.accountIdsTried,
    /** True when listing succeeded but returned zero repos (often missing `repo` OAuth scope for private repos). */
    reposEmptyLikelyScope: Boolean(
      !reposListedViaPat &&
        !latest.fetchError &&
        latest.repoListErrors.length === 0 &&
        latest.repos.length === 0,
    ),
    reposListedViaPat,
    ...payloadBase,
  })
}

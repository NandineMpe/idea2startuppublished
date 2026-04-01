import { splitGithubRepoRef } from "@/lib/github-vault"

/** Resolve owner/repo + branch for security scans from company_profile. */

export type CompanyProfileRepoRow = {
  github_repo: string | null
  github_branch: string | null
  github_vault_owner: string | null
  github_vault_repo: string | null
  github_vault_branch: string | null
}

export type ResolvedSecurityRepo = { repo: string; branch: string }

export function resolveGithubRepoFromProfile(row: CompanyProfileRepoRow): ResolvedSecurityRepo | null {
  const r = row.github_repo?.trim()
  if (r) {
    const branch = row.github_branch?.trim() || "main"
    return { repo: r.replace(/^\/+|\/+$/g, ""), branch }
  }

  const directVaultRepo = splitGithubRepoRef(row.github_vault_repo)
  if (directVaultRepo) {
    const branch = row.github_vault_branch?.trim() || "main"
    return { repo: `${directVaultRepo.owner}/${directVaultRepo.repo}`, branch }
  }

  const legacyOwner = row.github_vault_owner?.trim()
  const legacyRepo = row.github_vault_repo?.trim()
  if (legacyOwner && legacyRepo) {
    const branch = row.github_vault_branch?.trim() || "main"
    return { repo: `${legacyOwner}/${legacyRepo}`, branch }
  }
  return null
}

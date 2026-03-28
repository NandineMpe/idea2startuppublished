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
  const o = row.github_vault_owner?.trim()
  const n = row.github_vault_repo?.trim()
  if (o && n) {
    const branch = row.github_vault_branch?.trim() || "main"
    return { repo: `${o}/${n}`, branch }
  }
  return null
}

import { githubProxyGetJson } from "@/lib/juno/pipedream-github"

export type RepoTreeEntry = { path: string; size: number; type: string }

function splitRepo(full: string): { owner: string; name: string } | null {
  const parts = full.split("/").filter(Boolean)
  if (parts.length < 2) return null
  return { owner: parts[0], name: parts.slice(1).join("/") }
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/")
}

export async function getRepoTree(
  externalUserId: string,
  accountId: string,
  repoFull: string,
  branch: string,
): Promise<RepoTreeEntry[]> {
  const parsed = splitRepo(repoFull)
  if (!parsed) return []
  const { owner, name } = parsed
  const base = `https://api.github.com/repos/${owner}/${name}`

  const ref = await githubProxyGetJson<{ object: { sha: string } }>(
    externalUserId,
    accountId,
    `${base}/git/ref/heads/${encodeURIComponent(branch)}`,
  )
  const commitSha = ref?.object?.sha
  if (!commitSha) return []

  const commit = await githubProxyGetJson<{ tree: { sha: string } }>(
    externalUserId,
    accountId,
    `${base}/git/commits/${commitSha}`,
  )
  const treeSha = commit?.tree?.sha
  if (!treeSha) return []

  const tree = await githubProxyGetJson<{ tree?: Array<{ path?: string; size?: number; type?: string }>; truncated?: boolean }>(
    externalUserId,
    accountId,
    `${base}/git/trees/${treeSha}?recursive=1`,
  )
  const entries = tree?.tree ?? []
  const out: RepoTreeEntry[] = []
  for (const t of entries) {
    if (t.type !== "blob" || !t.path) continue
    out.push({
      path: t.path,
      size: typeof t.size === "number" ? t.size : 0,
      type: t.type,
    })
  }
  return out
}

type ContentsFile = {
  content?: string
  encoding?: string
  message?: string
}

export async function readRepoFile(
  externalUserId: string,
  accountId: string,
  repoFull: string,
  path: string,
  branch: string,
): Promise<string | null> {
  const parsed = splitRepo(repoFull)
  if (!parsed) return null
  const { owner, name } = parsed
  const base = `https://api.github.com/repos/${owner}/${name}`
  const url = `${base}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`
  const res = await githubProxyGetJson<ContentsFile | ContentsFile[]>(externalUserId, accountId, url)
  if (!res) return null
  if (Array.isArray(res)) return null
  if (res.encoding === "base64" && typeof res.content === "string") {
    const buf = Buffer.from(res.content.replace(/\s/g, ""), "base64")
    return buf.toString("utf8")
  }
  return null
}

type CommitListItem = { sha: string; commit?: { message?: string; author?: { date?: string } } }
type CommitDetail = {
  sha: string
  commit?: { message?: string; author?: { date?: string } }
  files?: Array<{ filename?: string }>
}

export async function getRecentCommits(
  externalUserId: string,
  accountId: string,
  repoFull: string,
  branch: string,
  days: number,
): Promise<Array<{ sha: string; message: string; date: string; files: string[] }>> {
  const parsed = splitRepo(repoFull)
  if (!parsed) return []
  const { owner, name } = parsed
  const base = `https://api.github.com/repos/${owner}/${name}`
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const listUrl = `${base}/commits?sha=${encodeURIComponent(branch)}&since=${encodeURIComponent(since)}&per_page=30`

  const list = await githubProxyGetJson<CommitListItem[]>(externalUserId, accountId, listUrl)
  if (!Array.isArray(list) || list.length === 0) return []

  const limited = list.slice(0, 20)
  const out: Array<{ sha: string; message: string; date: string; files: string[] }> = []

  for (const c of limited) {
    const sha = c.sha
    if (!sha) continue
    const detail = await githubProxyGetJson<CommitDetail>(
      externalUserId,
      accountId,
      `${base}/commits/${sha}`,
    )
    const files = (detail?.files ?? []).map((f) => f.filename).filter((x): x is string => Boolean(x))
    out.push({
      sha,
      message: detail?.commit?.message ?? c.commit?.message ?? "",
      date: detail?.commit?.author?.date ?? c.commit?.author?.date ?? "",
      files,
    })
  }

  return out
}

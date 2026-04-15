import { WorkspaceSlugRedirect } from "@/components/dashboard/workspace-slug-redirect"

function buildQueryString(values: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(values)) {
    if (typeof rawValue === "string") {
      params.append(key, rawValue)
      continue
    }

    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        params.append(key, value)
      }
    }
  }

  return params.toString()
}

export default async function WorkspaceScopedDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; path?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams

  return (
    <WorkspaceSlugRedirect
      workspaceSlug={resolvedParams.workspace}
      pathSegments={resolvedParams.path ?? []}
      queryString={buildQueryString(resolvedSearchParams)}
    />
  )
}


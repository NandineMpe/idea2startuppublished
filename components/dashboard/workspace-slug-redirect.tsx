"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

type WorkspaceSlugRedirectProps = {
  workspaceSlug: string
  pathSegments: string[]
  queryString: string
}

export function WorkspaceSlugRedirect({
  workspaceSlug,
  pathSegments,
  queryString,
}: WorkspaceSlugRedirectProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const targetPath = useMemo(() => {
    const base = `/dashboard${pathSegments.length > 0 ? `/${pathSegments.join("/")}` : ""}`
    return queryString ? `${base}?${queryString}` : base
  }, [pathSegments, queryString])

  useEffect(() => {
    let cancelled = false

    async function resolveSlug() {
      try {
        const response = await fetch("/api/workspaces/select-slug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ slug: workspaceSlug }),
        })

        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        if (!response.ok) {
          throw new Error(payload.error || "This workspace URL is not available for your account.")
        }

        if (!cancelled) {
          router.replace(targetPath)
          router.refresh()
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Could not open workspace dashboard.")
        }
      }
    }

    void resolveSlug()
    return () => {
      cancelled = true
    }
  }, [workspaceSlug, targetPath, router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-base font-semibold text-foreground">Workspace link unavailable</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <a
            href="/dashboard/settings"
            className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            Open settings
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Opening workspace dashboard
      </div>
    </div>
  )
}


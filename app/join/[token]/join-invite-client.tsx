"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type Preview = {
  organizationName: string
  email: string
  expired: boolean
  accepted: boolean
}

export function JoinInviteClient({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch(
        `/api/organizations/invitations/preview?token=${encodeURIComponent(token)}`,
      )
      const data = (await res.json()) as { error?: string } & Partial<Preview>
      if (cancelled) return
      if (!res.ok) {
        setLoadError(data.error || "This link is not valid.")
        return
      }
      setPreview({
        organizationName: data.organizationName ?? "",
        email: data.email ?? "",
        expired: Boolean(data.expired),
        accepted: Boolean(data.accepted),
      })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  const accept = useCallback(async () => {
    setBusy(true)
    setActionError(null)
    const res = await fetch("/api/organizations/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    })
    const data = (await res.json()) as { error?: string; organizationId?: string }

    if (res.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(`/join/${token}`)}`)
      return
    }

    if (!res.ok) {
      setActionError(data.error || "Could not join this team.")
      setBusy(false)
      return
    }

    if (data.organizationId) {
      await fetch("/api/organizations/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ organizationId: data.organizationId }),
      })
    }

    router.push("/dashboard")
  }, [router, token])

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 px-4 text-center">
        <h1 className="text-lg font-semibold text-foreground">Invite link</h1>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    )
  }

  if (preview.expired || preview.accepted) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 px-4 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          {preview.expired ? "This invite expired" : "This invite was already used"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Ask a teammate to send a new invite from Juno.
        </p>
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-foreground">Team invite</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are invited to <span className="font-medium text-foreground">{preview.organizationName}</span>{" "}
          on Juno.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Use the account for <span className="font-mono text-foreground">{preview.email}</span> when you sign
          in.
        </p>
      </div>

      {actionError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onClick={accept} disabled={busy} className="w-full sm:w-auto">
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Joining…
            </>
          ) : (
            "Accept and open Juno"
          )}
        </Button>
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}>Sign in first</Link>
        </Button>
      </div>
    </div>
  )
}

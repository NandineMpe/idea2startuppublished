"use client"

import { use, useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Preview = {
  email: string
  name: string
  company: string
  emailPreview: {
    market_signal: string
    competitor_move: string
    icp_insight: string
  }
}

export function ClaimAccountClient({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()

  const [preview, setPreview]       = useState<Preview | null>(null)
  const [loadError, setLoadError]   = useState<string | null>(null)
  const [password, setPassword]     = useState("")
  const [showPw, setShowPw]         = useState(false)
  const [claiming, setClaiming]     = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)

  // Load preview on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch(`/api/claim?token=${encodeURIComponent(token)}`)
      const data = await res.json() as { error?: string } & Partial<Preview>
      if (cancelled) return
      if (!res.ok) { setLoadError(data.error || "This link is not valid."); return }
      setPreview({
        email: data.email ?? "",
        name: data.name ?? "",
        company: data.company ?? "",
        emailPreview: data.emailPreview ?? { market_signal: "", competitor_move: "", icp_insight: "" },
      })
    }
    load()
    return () => { cancelled = true }
  }, [token])

  const claim = useCallback(async () => {
    if (password.length < 8) { setClaimError("Password must be at least 8 characters"); return }
    setClaiming(true)
    setClaimError(null)

    const res = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json() as { ok?: boolean; redirect?: string; magicLink?: string; error?: string }

    if (!res.ok) {
      setClaimError(data.error || "Something went wrong. Try again.")
      setClaiming(false)
      return
    }

    // If we got a magic link, use it to sign in directly then redirect
    if (data.magicLink) {
      window.location.href = data.magicLink
      return
    }

    router.push(data.redirect ?? "/dashboard")
  }, [token, password, router])

  // ── loading ────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button variant="outline" asChild>
            <a href="/login">Sign in</a>
          </Button>
        </div>
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    )
  }

  const firstName = preview.name?.split(" ")[0] || "there"
  const bullets = [
    preview.emailPreview.market_signal,
    preview.emailPreview.competitor_move,
    preview.emailPreview.icp_insight,
  ].filter(Boolean)

  // ── claim form ─────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Juno</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Hey {firstName}, your account is ready.
          </h1>
          <p className="text-sm text-muted-foreground">
            Juno already mapped {preview.company}. Set a password to unlock it.
          </p>
        </div>

        {/* Intelligence preview */}
        {bullets.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/30 px-5 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              This morning's intelligence
            </p>
            <ul className="space-y-2">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
                  <span className="mt-0.5 shrink-0 text-primary">→</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Password form */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm text-muted-foreground">
              Account
            </label>
            <Input
              id="email"
              type="email"
              value={preview.email}
              disabled
              className="bg-muted text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm text-muted-foreground">
              Set your password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") claim() }}
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {claimError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {claimError}
            </p>
          )}

          <Button onClick={claim} disabled={claiming || password.length < 1} className="w-full">
            {claiming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activating your account…
              </>
            ) : (
              "Open my dashboard →"
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="underline underline-offset-2 hover:text-foreground">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}

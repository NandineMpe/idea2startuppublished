"use client"

import { useState, useTransition } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { junoLoginAction, junoSignupAction } from "@/app/actions/juno-auth-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function JunoAuthForm({
  pagePath,
  afterAuthPath,
  message,
  messageBannerClassName = "",
}: {
  pagePath: "/" | "/login"
  afterAuthPath: string
  message?: string
  /** Precomputed on the server. Do not pass functions from RSC into this client component. */
  messageBannerClassName?: string
}) {
  const [, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<"login" | "signup" | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | undefined
    const kind = submitter?.dataset.auth as "login" | "signup" | undefined
    if (!kind) return

    const fd = new FormData(form)
    fd.set("pagePath", pagePath)
    fd.set("afterAuthPath", afterAuthPath)

    setPendingAction(kind)
    startTransition(async () => {
      try {
        if (kind === "login") {
          await junoLoginAction(fd)
        } else {
          await junoSignupAction(fd)
        }
      } finally {
        setPendingAction(null)
      }
    })
  }

  const busy = pendingAction !== null
  const loginLoading = pendingAction === "login"
  const signupLoading = pendingAction === "signup"

  return (
    <form
      className="mt-8 space-y-5 text-slate-950 dark:text-white"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="name">
          Name
        </Label>
        <Input
          id="name"
          type="text"
          name="name"
          autoComplete="name"
          placeholder="Founder name"
          disabled={busy}
          className="h-14 rounded-[1.2rem] border-slate-200 bg-white px-4 text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-[#091924] dark:text-white dark:placeholder:text-slate-500"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="email">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="founder@company.com"
          required
          disabled={busy}
          className="h-14 rounded-[1.2rem] border-slate-200 bg-white px-4 text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-[#091924] dark:text-white dark:placeholder:text-slate-500"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="password">
            Password
          </Label>
          <span className="text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            Min 8 chars
          </span>
        </div>
        <Input
          id="password"
          type="password"
          name="password"
          autoComplete="current-password"
          minLength={8}
          placeholder="Enter your password"
          required
          disabled={busy}
          className="h-14 rounded-[1.2rem] border-slate-200 bg-white px-4 text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-[#091924] dark:text-white dark:placeholder:text-slate-500"
        />
      </div>

      <div className="grid gap-3 pt-2 sm:grid-cols-2">
        <Button
          type="submit"
          data-auth="login"
          disabled={busy}
          className="h-14 rounded-[1.2rem] bg-slate-950 text-white shadow-[0_16px_40px_rgba(15,23,42,0.16)] hover:bg-slate-800 dark:bg-sky-100 dark:text-slate-950 dark:hover:bg-white"
        >
          {loginLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        <Button
          type="submit"
          data-auth="signup"
          disabled={busy}
          variant="outline"
          className="h-14 rounded-[1.2rem] border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/10"
        >
          {signupLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Sign up"
          )}
        </Button>
      </div>

      {message ? (
        <div
          className={`rounded-[1.2rem] border px-4 py-3 text-sm leading-7 ${messageBannerClassName}`}
        >
          {message}
        </div>
      ) : null}
    </form>
  )
}

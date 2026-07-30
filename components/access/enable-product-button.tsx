"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { enableProductForCurrentUser } from "@/lib/product-access"

/** Adds an OS to the signed-in account, then goes there. */
export function EnableProductButton({
  product,
  label,
  className,
}: {
  product: string
  label: string
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function enable() {
    startTransition(async () => {
      setError(null)
      const result = await enableProductForCurrentUser(product)
      if (result.ok) router.push(result.href)
      else setError(result.error)
    })
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button onClick={enable} disabled={pending} className={className}>
        {pending ? "Enabling…" : label}
      </button>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </span>
  )
}

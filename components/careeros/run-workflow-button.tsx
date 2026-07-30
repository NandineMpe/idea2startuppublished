"use client"

import { useState } from "react"
import { CareerOsBtn } from "@/components/careeros/ui"
import { CareerOsIcon } from "@/components/careeros/icon"
import { toast } from "sonner"

type RunWorkflowButtonProps = {
  workflow: string
  label: string
  successMessage?: string
  sm?: boolean
  ghost?: boolean
}

export function RunWorkflowButton({
  workflow,
  label,
  successMessage = "Queued. Updates usually land in a few minutes.",
  sm,
  ghost,
}: RunWorkflowButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch("/api/careeros/workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workflow }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error || "Could not queue workflow")
      toast.success(data.message ?? successMessage)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not queue workflow")
    } finally {
      setLoading(false)
    }
  }

  return (
    <CareerOsBtn sm={sm} ghost={ghost} onClick={handleClick} disabled={loading}>
      <CareerOsIcon name={loading ? "clock" : "sparkles"} size={14} />
      {loading ? "Queuing…" : label}
    </CareerOsBtn>
  )
}

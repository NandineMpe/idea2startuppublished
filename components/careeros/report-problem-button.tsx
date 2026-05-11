"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Props = {
  section: string
  fieldPath?: string
  currentValue: unknown
  extractionId?: string | null
}

export function ReportProblemButton({ section, fieldPath, currentValue, extractionId }: Props) {
  const [busy, setBusy] = useState(false)

  async function onReport() {
    const userCorrection = window.prompt("Describe what is wrong and what it should be:")
    if (!userCorrection || userCorrection.trim().length === 0) return
    setBusy(true)
    try {
      const res = await fetch("/api/careeros/profile-corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          extractionId: extractionId ?? null,
          section,
          fieldPath: fieldPath ?? null,
          currentValue,
          userCorrection: userCorrection.trim(),
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(json.error || "Could not save correction")
        return
      }
      toast.success("Thanks — your correction was recorded.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onReport}>
      {busy ? "Saving..." : "Report a problem"}
    </Button>
  )
}

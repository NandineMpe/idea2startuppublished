"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WorkspaceSummary } from "@/types/workspace"

type WorkspaceResponse = {
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string | null
}

export function WorkspaceSwitcher() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [selected, setSelected] = useState("owner")

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const response = await fetch("/api/workspaces", { credentials: "include" })
        const data = (await response.json()) as WorkspaceResponse
        if (cancelled || !response.ok) return

        const list = data.workspaces ?? []
        setWorkspaces(list)
        const raw = data.activeWorkspaceId ?? "owner"
        const allowed = new Set(["owner", ...list.map((w) => w.id)])
        setSelected(allowed.has(raw) ? raw : "owner")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const safeSelected = useMemo(() => {
    if (selected === "owner") return "owner"
    return workspaces.some((w) => w.id === selected) ? selected : "owner"
  }, [selected, workspaces])

  useEffect(() => {
    if (loading) return
    if (selected !== "owner" && !workspaces.some((w) => w.id === selected)) {
      setSelected("owner")
    }
  }, [loading, selected, workspaces])

  const currentWorkspace =
    safeSelected === "owner" ? null : workspaces.find((workspace) => workspace.id === safeSelected) ?? null

  function handleChange(value: string) {
    setSelected(value)

    startTransition(() => {
      void fetch("/api/workspaces/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          workspaceId: value === "owner" ? null : value,
        }),
      }).then(() => {
        router.refresh()
        window.location.reload()
      })
    })
  }

  if (loading) {
    return (
      <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-[13px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading workspace</span>
      </div>
    )
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={safeSelected} onValueChange={handleChange} disabled={pending}>
        <SelectTrigger className="h-8 w-[240px] border-border bg-surface-2 text-[13px]">
          <SelectValue placeholder={currentWorkspace?.displayName || "Your company"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="owner">Your company</SelectItem>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.id} value={workspace.id}>
              {workspace.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { RunWorkflowButton } from "@/components/careeros/run-workflow-button"

type WorkflowItem = {
  key: string
  scope: string
  label: string
  description: string
}

type CareerWorkflowPanelProps = {
  /** Show one-line descriptions under each button group */
  showDescriptions?: boolean
  className?: string
}

export function CareerWorkflowPanel({
  showDescriptions = true,
  className,
}: CareerWorkflowPanelProps) {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/careeros/workflows/run", {
          credentials: "include",
          cache: "no-store",
        })
        const data = (await res.json()) as {
          workflows?: WorkflowItem[]
          error?: string
        }
        if (!res.ok) throw new Error(data.error || "Could not load workflows")
        if (!cancelled) {
          setWorkflows(data.workflows ?? [])
          setLoadError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Could not load workflows")
          setWorkflows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading workflows…</p>
  }

  if (loadError) {
    return (
      <p className="text-sm text-destructive">
        {loadError}
        {loadError.includes("INNGEST") ? (
          <> Set INNGEST_EVENT_KEY in Vercel to enable run buttons.</>
        ) : null}
      </p>
    )
  }

  if (!workflows.length) {
    return <p className="text-sm text-muted-foreground">No workflows available.</p>
  }

  const presets = workflows.filter((w) => w.scope === "preset")
  const singles = workflows.filter((w) => w.scope !== "preset")

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {presets.length > 0 ? (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Quick runs
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((w) => (
              <RunWorkflowButton key={w.key} workflow={w.key} label={w.label} />
            ))}
          </div>
          {showDescriptions ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-none p-0 m-0">
              {presets.map((w) => (
                <li key={`d-${w.key}`}>
                  <strong className="text-foreground">{w.label}:</strong> {w.description}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {singles.length > 0 ? (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Individual jobs
          </p>
          <div className="flex flex-wrap gap-2">
            {singles.map((w) => (
              <RunWorkflowButton key={w.key} workflow={w.key} label={w.label} sm />
            ))}
          </div>
          {showDescriptions ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-none p-0 m-0">
              {singles.map((w) => (
                <li key={`d-${w.key}`}>
                  <strong className="text-foreground">{w.label}:</strong> {w.description}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

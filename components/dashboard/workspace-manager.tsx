"use client"

import { useEffect, useState } from "react"
import { Copy, ExternalLink, Loader2, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import type { WorkspaceSummary } from "@/types/workspace"

type WorkspaceResponse = {
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string | null
}

const STATUS_COPY: Record<WorkspaceSummary["contextStatus"], string> = {
  draft: "Awaiting context",
  intake_started: "Intake in progress",
  ready: "Ready to generate",
}

export function WorkspaceManager() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [displayName, setDisplayName] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")

  async function load() {
    const response = await fetch("/api/workspaces", { credentials: "include" })
    const data = (await response.json()) as WorkspaceResponse
    if (!response.ok) throw new Error("Could not load workspaces")
    setWorkspaces(data.workspaces ?? [])
    setActiveWorkspaceId(data.activeWorkspaceId ?? null)
  }

  useEffect(() => {
    void load()
      .catch(() => {
        toast({ title: "Could not load workspaces", variant: "destructive" })
      })
      .finally(() => setLoading(false))
  }, [toast])

  async function handleCreate() {
    if (!displayName.trim()) {
      toast({ title: "Add a workspace name first", variant: "destructive" })
      return
    }

    setCreating(true)
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ displayName, contactName, contactEmail }),
      })

      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Could not create workspace")

      setDisplayName("")
      setContactName("")
      setContactEmail("")
      await load()
      toast({ title: "Workspace created" })
    } catch (error) {
      toast({
        title: "Could not create workspace",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  async function handleSelect(workspaceId: string | null) {
    setSelectingId(workspaceId ?? "__owner__")
    try {
      const response = await fetch("/api/workspaces/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workspaceId }),
      })

      if (!response.ok) throw new Error("Could not select workspace")
      setActiveWorkspaceId(workspaceId)
      toast({
        title: workspaceId ? "Workspace selected" : "Back on your company workspace",
      })
    } catch {
      toast({ title: "Could not select workspace", variant: "destructive" })
    } finally {
      setSelectingId(null)
    }
  }

  async function handleCopy(path: string) {
    const url = `${window.location.origin}${path}`
    await navigator.clipboard.writeText(url)
    toast({ title: "Intake link copied" })
  }

  async function handleCopyPreview(intakePath: string) {
    // intakePath is /intake/{token} — reuse same token for /preview/{token}
    const token = intakePath.replace("/intake/", "")
    const url = `${window.location.origin}/preview/${token}`
    await navigator.clipboard.writeText(url)
    toast({ title: "Preview link copied", description: "Anyone with this link can view the workspace — no login needed." })
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Create a client workspace</CardTitle>
          <CardDescription className="text-muted-foreground">
            Each workspace gets its own share link, context, and selectable company brain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Acme Capital"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-contact-name">Contact name</Label>
              <Input
                id="workspace-contact-name"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                placeholder="Jordan Lee"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-contact-email">Contact email</Label>
              <Input
                id="workspace-contact-email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="jordan@acme.com"
              />
            </div>
          </div>

          <Button onClick={() => void handleCreate()} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create workspace
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Workspace links</CardTitle>
          <CardDescription className="text-muted-foreground">
            Share an intake link, wait for context, then switch the dashboard into that workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background/40 px-4 py-3">
            <div className="flex-1 text-sm text-muted-foreground">
              Current dashboard scope:{" "}
              <span className="font-medium text-foreground">
                {activeWorkspaceId
                  ? workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.displayName ||
                    "Selected workspace"
                  : "Your company"}
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => void handleSelect(null)}
              disabled={!activeWorkspaceId || selectingId !== null}
            >
              {selectingId === "__owner__" ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Switching
                </>
              ) : (
                "Use your company"
              )}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading workspaces
            </div>
          ) : workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No client workspaces yet.</p>
          ) : (
            <div className="space-y-3">
              {workspaces.map((workspace) => {
                const isActive = activeWorkspaceId === workspace.id
                return (
                  <div
                    key={workspace.id}
                    className="rounded-lg border border-border bg-background/30 px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{workspace.displayName}</p>
                          <Badge variant={workspace.contextStatus === "ready" ? "default" : "secondary"}>
                            {STATUS_COPY[workspace.contextStatus]}
                          </Badge>
                          {isActive && <Badge variant="outline">Active in dashboard</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {workspace.contactName || "No contact yet"}
                          {workspace.contactEmail ? ` | ${workspace.contactEmail}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Link: <span className="font-mono">{workspace.intakePath}</span>
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleCopyPreview(workspace.intakePath)}
                        >
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          Share preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleCopy(workspace.intakePath)}
                        >
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Copy intake link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(workspace.intakePath, "_blank", "noopener,noreferrer")}
                        >
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          Open intake
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(`/${workspace.slug}/dashboard`, "_blank", "noopener,noreferrer")
                          }
                        >
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          Open dashboard
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void handleSelect(workspace.id)}
                          disabled={selectingId === workspace.id}
                        >
                          {selectingId === workspace.id ? (
                            <>
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              Switching
                            </>
                          ) : (
                            "Use in dashboard"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, ChevronDown, Loader2, MailPlus, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type Org = {
  id: string
  displayName: string
  slug: string
  isPersonal: boolean
  role?: "owner" | "admin" | "member"
}

type ClientWorkspace = {
  id: string
  displayName: string
  contextStatus: "draft" | "intake_started" | "ready"
}

type PendingInvite = {
  id: string
  email: string
  role: string
  expires_at: string
  created_at: string
}

export function OrganizationSwitcher({ expanded }: { expanded: boolean }) {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [teamName, setTeamName] = useState("")
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member")
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations", { credentials: "include" })
      const orgData = (await res.json()) as {
        organizations?: Org[]
        activeOrganizationId?: string | null
      }
      setOrgs(orgData.organizations ?? [])
      setActiveId(orgData.activeOrganizationId ?? null)
    } catch {
      setOrgs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const activeOrg = useMemo(() => {
    if (!orgs.length) return null
    const byId = activeId ? orgs.find((o) => o.id === activeId) : null
    return byId ?? orgs[0] ?? null
  }, [orgs, activeId])

  const canInvite = Boolean(
    activeOrg &&
      !activeOrg.isPersonal &&
      (activeOrg.role === "owner" || activeOrg.role === "admin"),
  )

  const loadPendingInvites = useCallback(async () => {
    if (!activeOrg?.id || !canInvite) {
      setPendingInvites([])
      return
    }
    const res = await fetch(
      `/api/organizations/invitations?organizationId=${encodeURIComponent(activeOrg.id)}`,
      { credentials: "include" },
    )
    if (!res.ok) {
      setPendingInvites([])
      return
    }
    const data = (await res.json()) as { invitations?: PendingInvite[] }
    setPendingInvites(data.invitations ?? [])
  }, [activeOrg?.id, canInvite])

  useEffect(() => {
    if (!inviteOpen) return
    void loadPendingInvites()
  }, [inviteOpen, loadPendingInvites])

  async function onSelect(orgId: string) {
    if (orgId === activeId) return
    const res = await fetch("/api/organizations/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ organizationId: orgId }),
    })
    if (res.ok) {
      setActiveId(orgId)
      router.refresh()
    }
  }

  async function handleCreateTeam() {
    const name = teamName.trim()
    if (!name) {
      setCreateError("Enter a team name.")
      return
    }
    setCreateBusy(true)
    setCreateError(null)
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ displayName: name }),
    })
    const data = (await res.json()) as { error?: string; organization?: { id: string } }
    if (!res.ok) {
      setCreateError(data.error || "Could not create team.")
      setCreateBusy(false)
      return
    }
    const newId = data.organization?.id
    if (newId) {
      await fetch("/api/organizations/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ organizationId: newId }),
      })
    }
    setCreateOpen(false)
    setTeamName("")
    setCreateBusy(false)
    await load()
    router.refresh()
  }

  async function handleSendInvite() {
    if (!activeOrg?.id) return
    setInviteBusy(true)
    setInviteError(null)
    const res = await fetch("/api/organizations/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        organizationId: activeOrg.id,
        email: inviteEmail,
        role: inviteRole,
      }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setInviteError(data.error || "Could not send invite.")
      setInviteBusy(false)
      return
    }
    setInviteEmail("")
    setInviteBusy(false)
    await loadPendingInvites()
  }

  async function handleRevokeInvite(id: string) {
    const res = await fetch(
      `/api/organizations/invitations?id=${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "include" },
    )
    if (res.ok) {
      await loadPendingInvites()
    }
  }

  const radioValue = activeId ?? orgs[0]?.id ?? ""

  if (loading) {
    return (
      <div
        className={cn(
          "border-b border-border flex items-center gap-2 text-muted-foreground",
          expanded ? "px-3 py-2.5" : "px-1 py-2 justify-center",
        )}
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        {expanded ? <span className="text-[12px]">Loading workspaces…</span> : null}
      </div>
    )
  }

  const triggerLabel = activeOrg?.displayName ?? "Workspace"

  return (
    <>
      <div
        className={cn(
          "border-b border-border",
          expanded ? "flex flex-col gap-1.5 px-3 py-2.5" : "flex justify-center px-1 py-2",
        )}
      >
        {expanded ? (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Team</span>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size={expanded ? "sm" : "icon"}
              className={cn(
                "gap-1.5",
                expanded ? "w-full justify-between h-9 px-2.5 font-normal" : "h-9 w-9 shrink-0",
              )}
              title={expanded ? undefined : triggerLabel}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {expanded ? (
                <>
                  <span className="truncate flex-1 text-left text-[12px]">{triggerLabel}</span>
                  {activeOrg?.isPersonal ? (
                    <span className="text-[10px] text-muted-foreground shrink-0">Personal</span>
                  ) : null}
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                </>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[12rem] max-w-[20rem]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Switch workspace
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={radioValue} onValueChange={onSelect}>
              {orgs.map((o) => (
                <DropdownMenuRadioItem key={o.id} value={o.id} className="text-sm">
                  <span className="truncate">
                    {o.displayName}
                    {o.isPersonal ? " (personal)" : ""}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create team
            </DropdownMenuItem>
            {canInvite ? (
              <DropdownMenuItem
                onSelect={() => {
                  setInviteError(null)
                  setInviteOpen(true)
                }}
                className="gap-2"
              >
                <MailPlus className="h-4 w-4" />
                Invite people
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            setCreateError(null)
            setTeamName("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create team workspace</DialogTitle>
            <DialogDescription>
              Teams get their own context, assets, and chats. You can invite others after you create it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="org-team-name">Team name</Label>
            <Input
              id="org-team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Acme Labs"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateTeam()
              }}
            />
            {createError ? (
              <p className="text-sm text-destructive">{createError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCreateTeam()} disabled={createBusy}>
              {createBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open)
          if (!open) {
            setInviteError(null)
            setInviteEmail("")
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite people</DialogTitle>
            <DialogDescription>
              We email a link to join{" "}
              <span className="font-medium text-foreground">{activeOrg?.displayName}</span>. They must sign in with
              that email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "member" | "admin")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteError ? <p className="text-sm text-destructive">{inviteError}</p> : null}
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void handleSendInvite()}
              disabled={inviteBusy || !inviteEmail.trim()}
            >
              {inviteBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send invite email"
              )}
            </Button>
          </div>
          {pendingInvites.length > 0 ? (
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Pending invites
              </p>
              <ul className="space-y-2">
                {pendingInvites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.role} · expires{" "}
                        {new Date(inv.expires_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => void handleRevokeInvite(inv.id)}
                      aria-label={`Revoke invite for ${inv.email}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, Check, Loader2, Link as LinkIcon, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"

type Share = {
  id: string
  slug: string
  label: string
  userId: string
  organizationId: string | null
  workspaceId: string | null
  showSignalFeed: boolean
  showSecurityAlerts: boolean
  showBehavioral: boolean
  showIntentSignals: boolean
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  url: string
}

export default function IntelligencePreviewAdminPage() {
  const { toast } = useToast()
  const [shares, setShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const [slug, setSlug] = useState("corgi")
  const [label, setLabel] = useState("Corgi")
  const [userId, setUserId] = useState("")
  const [workspaceSlug, setWorkspaceSlug] = useState("")
  const [organizationSlug, setOrganizationSlug] = useState("")
  const [showSignalFeed, setShowSignalFeed] = useState(true)
  const [showSecurityAlerts, setShowSecurityAlerts] = useState(true)
  const [showBehavioral, setShowBehavioral] = useState(true)
  const [showIntentSignals, setShowIntentSignals] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/intelligence-preview", { cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        toast({ title: "Admin access required", variant: "destructive" })
        return
      }
      const data = (await res.json()) as { shares?: Share[] }
      setShares(data.shares ?? [])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function createShare() {
    if (!slug.trim() || !label.trim()) {
      toast({ title: "Slug and label are required", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/admin/intelligence-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          label,
          userId: userId.trim() || undefined,
          workspaceSlug: workspaceSlug.trim() || undefined,
          organizationSlug: organizationSlug.trim() || undefined,
          flags: {
            showSignalFeed,
            showSecurityAlerts,
            showBehavioral,
            showIntentSignals,
          },
        }),
      })
      const data = (await res.json()) as { error?: string; url?: string }
      if (!res.ok) {
        toast({ title: "Could not create share", description: data.error, variant: "destructive" })
        return
      }
      toast({ title: "Preview link created", description: data.url })
      await load()
    } finally {
      setCreating(false)
    }
  }

  async function copyUrl(url: string, id: string) {
    await navigator.clipboard.writeText(url)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this preview link? Viewers will see a 404 after this.")) return
    const res = await fetch(`/api/admin/intelligence-preview?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      toast({ title: "Could not deactivate", description: data.error, variant: "destructive" })
      return
    }
    await load()
  }

  return (
    <div className="min-h-screen bg-muted/20 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Intelligence preview links</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Read-only share URLs that expose only the Intelligence Feed for a specific account.
            Send one to a company, they see their brief, behavioral updates, and hot intent count.
            Nothing else.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create a new share</CardTitle>
            <CardDescription>
              Defaults to your own account. Provide a workspace or organization slug to scope the
              feed to a specific client workspace instead.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug (URL path)</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="corgi"
                />
                <p className="text-[11px] text-muted-foreground">
                  Preview URL: /preview/intelligence/<span className="font-mono">{slug || "<slug>"}</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="label">Label (shown on the page)</Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Corgi"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workspace">Client workspace slug (optional)</Label>
                <Input
                  id="workspace"
                  value={workspaceSlug}
                  onChange={(e) => setWorkspaceSlug(e.target.value)}
                  placeholder="corgi"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org">Organization slug (optional)</Label>
                <Input
                  id="org"
                  value={organizationSlug}
                  onChange={(e) => setOrganizationSlug(e.target.value)}
                  placeholder="corgi-inc"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="userId">Target user_id (advanced, optional)</Label>
                <Input
                  id="userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Leave blank to use your own account"
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Show on the preview</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "signal", label: "Signal feed (daily brief)", value: showSignalFeed, set: setShowSignalFeed },
                  { key: "security", label: "Security alerts", value: showSecurityAlerts, set: setShowSecurityAlerts },
                  { key: "behavioral", label: "Customer behavior", value: showBehavioral, set: setShowBehavioral },
                  { key: "intent", label: "Hot intent signals", value: showIntentSignals, set: setShowIntentSignals },
                ].map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={f.value} onCheckedChange={(v) => f.set(!!v)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={createShare} disabled={creating} className="gap-1.5">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create preview link
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active share links</CardTitle>
            <CardDescription>Copy and send these to clients or stakeholders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : shares.length === 0 ? (
              <p className="text-sm text-muted-foreground">No share links yet.</p>
            ) : (
              shares.map((share) => (
                <div
                  key={share.id}
                  className={[
                    "rounded-lg border px-3 py-2.5 flex items-center gap-3",
                    share.isActive ? "border-border bg-background" : "border-border/50 bg-muted/30 opacity-60",
                  ].join(" ")}
                >
                  <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{share.label}</p>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">{share.url}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyUrl(share.url, share.id)}
                    className="h-8 gap-1.5 text-xs"
                    disabled={!share.isActive}
                  >
                    {copied === share.id ? (
                      <><Check className="h-3.5 w-3.5" /> Copied</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> Copy</>
                    )}
                  </Button>
                  {share.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deactivate(share.id)}
                      className="h-8 px-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

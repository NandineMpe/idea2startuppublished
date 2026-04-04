"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, Gift, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

type MePayload = {
  shareUrl: string
  inviteCount: number
}

export function InviteFriendsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<MePayload | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/referrals/me", { credentials: "include" })
    const json = (await res.json()) as MePayload & { error?: string }
    if (!res.ok) {
      setError(json.error || "Could not load your link.")
      setData(null)
      setLoading(false)
      return
    }
    setData({ shareUrl: json.shareUrl, inviteCount: json.inviteCount })
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  async function copyLink() {
    if (!data?.shareUrl) return
    try {
      await navigator.clipboard.writeText(data.shareUrl)
      toast({ title: "Copied", description: "Share link is on your clipboard." })
    } catch {
      toast({
        title: "Copy failed",
        description: "Select the link and copy it manually.",
        variant: "destructive",
      })
    }
  }

  const mailto =
    data?.shareUrl &&
    `mailto:?subject=${encodeURIComponent("Join me on Juno AI")}&body=${encodeURIComponent(
      `I use Juno for founder intelligence and context in one workspace. Start here:\n\n${data.shareUrl}`,
    )}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" aria-hidden />
            Invite friends to Juno
          </DialogTitle>
          <DialogDescription>
            Share your link. When someone signs up from it, we tie their account to you for your own
            records. Team invites for shared workspaces stay under Team in the sidebar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading your link…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : data ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Your link</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">{data.shareUrl}</p>
            </div>
            {data.inviteCount > 0 ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{data.inviteCount}</span>{" "}
                {data.inviteCount === 1 ? "person has" : "people have"} signed up from your link so far.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No sign-ups from your link yet. Drop it in a DM or email.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="button" onClick={() => void copyLink()} className="gap-2">
                <Copy className="h-4 w-4" />
                Copy link
              </Button>
              {mailto ? (
                <Button type="button" variant="outline" asChild>
                  <a href={mailto}>Draft email</a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

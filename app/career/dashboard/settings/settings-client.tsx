"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { CheckCircle2, AlertCircle, ExternalLink, Trash2 } from "lucide-react"
import { CareerWorkflowPanel } from "@/components/careeros/career-workflow-panel"
import { toast } from "sonner"

type Profile = {
  current_role_title?: string | null
  target_role_title?: string | null
  location_label?: string | null
  years_experience?: number | null
  current_salary_usd?: number | null
} | null

export function CareerSettingsClient({
  accountEmail,
  displayName: initialDisplayName,
  hideEmail: initialHideEmail,
  publicName,
  onboardingComplete,
  profile,
}: {
  accountEmail: string
  displayName: string
  hideEmail: boolean
  publicName: string
  onboardingComplete: boolean
  profile: Profile
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [hideEmail, setHideEmail] = useState(initialHideEmail)
  const [saving, setSaving] = useState(false)

  async function handleSaveDisplay() {
    setSaving(true)
    try {
      const res = await fetch("/api/careeros/settings/display", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          hide_email: hideEmail,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Could not save")
      window.dispatchEvent(new Event("careeros-display-prefs-updated"))
      toast.success("Display settings saved")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch("/api/careeros/account/delete", { method: "DELETE" })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(error)
      }
      const supabase = createClient()
      await supabase.auth.signOut()
      router.replace("/career")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete account.")
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {hideEmail
            ? `Signed in as ${publicName}. Email hidden in Career OS.`
            : accountEmail}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Display & demo</CardTitle>
          <CardDescription>
            Control what shows in the sidebar and welcome message. Use a display name and hide
            your Google email when recording or presenting live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={publicName}
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              Shown in the sidebar and &quot;Welcome back&quot; on the dashboard. Leave blank to
              use your account name.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="hide-email" className="text-sm font-medium">
                Hide email in Career OS
              </Label>
              <p className="text-xs text-muted-foreground">
                Removes your sign-in email from the sidebar. Only you see the real address on this
                page.
              </p>
            </div>
            <Switch id="hide-email" checked={hideEmail} onCheckedChange={setHideEmail} />
          </div>

          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Preview</p>
            <p className="font-medium text-foreground">{displayName.trim() || publicName}</p>
            {hideEmail ? (
              <p className="text-xs text-muted-foreground mt-1">Email hidden</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1 truncate">{accountEmail}</p>
            )}
          </div>

          <Button type="button" size="sm" disabled={saving} onClick={() => void handleSaveDisplay()}>
            {saving ? "Saving…" : "Save display settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Refresh career data</CardTitle>
          <CardDescription>
            Run ingest pipelines on demand (queued via Inngest). Use after onboarding or when
            chat and feed feel stale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CareerWorkflowPanel />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {onboardingComplete ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
            <CardTitle className="text-base">Career profile</CardTitle>
          </div>
          <CardDescription>
            {onboardingComplete
              ? "Your profile is set up. Update it any time as your situation changes."
              : "Complete your profile so CareerOS can personalise your feed, skill analysis, and market data."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile && onboardingComplete && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {profile.current_role_title && (
                <>
                  <span className="text-muted-foreground">Current role</span>
                  <span className="text-foreground">{profile.current_role_title}</span>
                </>
              )}
              {profile.target_role_title && (
                <>
                  <span className="text-muted-foreground">Target role</span>
                  <span className="text-foreground">{profile.target_role_title}</span>
                </>
              )}
              {profile.location_label && (
                <>
                  <span className="text-muted-foreground">Location</span>
                  <span className="text-foreground">{profile.location_label}</span>
                </>
              )}
              {profile.years_experience != null && (
                <>
                  <span className="text-muted-foreground">Experience</span>
                  <span className="text-foreground">{profile.years_experience} years</span>
                </>
              )}
            </div>
          )}
          <Button asChild variant={onboardingComplete ? "outline" : "default"} size="sm">
            <Link href="/careeros/onboarding">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              {onboardingComplete ? "Update profile" : "Complete profile setup"}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Permanently delete your CareerOS account and all associated data. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {deleting ? "Deleting…" : "Delete account"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your profile, skills, feed, and all CareerOS data for{" "}
                  <strong>{accountEmail}</strong>. Your account cannot be recovered.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, delete my account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}

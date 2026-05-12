"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { toast } from "sonner"

type Profile = {
  current_role_title?: string | null
  target_role_title?: string | null
  location_label?: string | null
  years_experience?: number | null
  current_salary_usd?: number | null
} | null

export function CareerSettingsClient({
  email,
  onboardingComplete,
  profile,
}: {
  email: string
  onboardingComplete: boolean
  profile: Profile
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch("/api/careeros/account/delete", { method: "DELETE" })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(error)
      }
      // Sign out client-side then go to career login
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
        <p className="text-sm text-muted-foreground mt-1">{email}</p>
      </div>

      {/* Profile / Onboarding */}
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

      {/* Danger zone */}
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
                  <strong>{email}</strong>. Your account cannot be recovered.
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

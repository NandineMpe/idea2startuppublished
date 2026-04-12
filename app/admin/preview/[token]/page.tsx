"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { CheckCircle2, Clock, Eye, Loader2, Send, Copy, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type InviteData = {
  id: string
  email: string
  name: string
  company: string
  seededAt: string
  emailSentAt: string | null
  claimedAt: string | null
  emailPreview: {
    market_signal?: string
    competitor_move?: string
    icp_insight?: string
  } | null
}

type Profile = {
  company_name: string
  tagline: string | null
  company_description: string | null
  problem: string | null
  solution: string | null
  target_market: string | null
  stage: string | null
  vertical: string | null
  business_model: string | null
  traction: string | null
  founder_name: string | null
  founder_background: string | null
  icp: string[]
  competitors: string[]
  priorities: string[]
  risks: string[]
  keywords: string[]
  knowledge_base_md: string | null
}

type Output = {
  id: string
  tool: string
  title: string
  output: string
  created_at: string
}

export default function AdminPreviewPage() {
  const params = useParams()
  const router = useRouter()
  const token = typeof params.token === "string" ? params.token : ""

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [outputs, setOutputs] = useState<Output[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token) return
    void (async () => {
      try {
        const res = await fetch(`/api/admin/preview-account?token=${encodeURIComponent(token)}`)
        if (res.status === 401 || res.status === 403) {
          router.replace("/login")
          return
        }
        const data = (await res.json()) as { invite?: InviteData; profile?: Profile; outputs?: Output[]; error?: string }
        if (!res.ok || !data.invite) {
          throw new Error(data.error ?? "Could not load preview")
        }
        setInvite(data.invite)
        setProfile(data.profile ?? null)
        setOutputs(data.outputs ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load preview")
      } finally {
        setLoading(false)
      }
    })()
  }, [token, router])

  function copyClaimLink() {
    const url = `${window.location.origin}/claim/${token}`
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Preview unavailable</CardTitle>
            <CardDescription>{error ?? "Invite not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const claimUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/claim/${token}`
  const brief = outputs.find((o) => o.tool === "daily_brief")
  const competitors = outputs.find((o) => o.tool === "competitor-snapshot")
  const content = outputs.find((o) => o.tool === "content_linkedin")

  return (
    <div className="min-h-screen bg-muted/20 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Banner */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Eye className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Admin preview — {invite.name} · {invite.company}
              </p>
              <p className="text-xs text-muted-foreground">
                This is exactly what {invite.name?.split(" ")[0] ?? "the founder"} will see after claiming their account.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {invite.claimedAt ? (
                <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Claimed</>
              ) : invite.emailSentAt ? (
                <><Send className="h-3.5 w-3.5" /> Emailed</>
              ) : (
                <><Clock className="h-3.5 w-3.5" /> Seeded</>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={copyClaimLink} className="gap-1.5 h-8 text-xs">
              {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy claim link</>}
            </Button>
          </div>
        </div>

        {/* Claim link display */}
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground break-all">
          {claimUrl}
        </div>

        {/* Email preview bullets */}
        {invite.emailPreview && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">What the email shows</CardTitle>
              <CardDescription>Intelligence bullets from the outreach email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {invite.emailPreview.market_signal && (
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-2">Market</span>
                  {invite.emailPreview.market_signal}
                </div>
              )}
              {invite.emailPreview.competitor_move && (
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-2">Competitor</span>
                  {invite.emailPreview.competitor_move}
                </div>
              )}
              {invite.emailPreview.icp_insight && (
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-2">ICP</span>
                  {invite.emailPreview.icp_insight}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Company profile */}
        {profile && (
          <Card>
            <CardHeader>
              <CardTitle>{profile.company_name}</CardTitle>
              {profile.tagline && <CardDescription>{profile.tagline}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Stage", value: profile.stage },
                  { label: "Vertical", value: profile.vertical },
                  { label: "Founder", value: profile.founder_name },
                  { label: "Model", value: profile.business_model },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="text-xs font-medium text-foreground mt-0.5 truncate">{value}</p>
                  </div>
                ) : null)}
              </div>
              {profile.company_description && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Description</p>
                  <p className="text-sm text-foreground/90 leading-relaxed">{profile.company_description}</p>
                </div>
              )}
              {profile.icp && profile.icp.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">ICP</p>
                  <ul className="space-y-0.5">
                    {profile.icp.map((item, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex gap-1.5"><span className="text-primary">→</span>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {profile.competitors && profile.competitors.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Competitors</p>
                  <p className="text-xs text-foreground/80">{profile.competitors.join(", ")}</p>
                </div>
              )}
              {profile.traction && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Traction</p>
                  <p className="text-xs text-foreground/80">{profile.traction}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pre-seeded AI outputs */}
        {brief && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Morning Market Brief</CardTitle>
              <CardDescription>Pre-seeded — visible immediately on first login</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-xs text-foreground/90 leading-relaxed font-sans">{brief.output}</pre>
            </CardContent>
          </Card>
        )}

        {competitors && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Competitor Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-xs text-foreground/90 leading-relaxed font-sans">{competitors.output}</pre>
            </CardContent>
          </Card>
        )}

        {content && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">LinkedIn Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-xs text-foreground/90 leading-relaxed font-sans">{content.output}</pre>
            </CardContent>
          </Card>
        )}

        {outputs.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">No pre-seeded outputs yet</CardTitle>
              <CardDescription>The seeder may still be running, or the pre-run failed. The founder can still claim and the pipelines will run on schedule.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  )
}

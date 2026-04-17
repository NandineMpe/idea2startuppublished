"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, Loader2, Lock, Target, Users, Zap, TrendingUp, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type WorkspacePreview = {
  workspace: {
    displayName: string
    companyName: string | null
    contactName: string | null
    contextStatus: string
  }
  profile: {
    company_name: string | null
    company_description: string | null
    tagline: string | null
    problem: string | null
    solution: string | null
    target_market: string | null
    industry: string | null
    stage: string | null
    traction: string | null
    founder_name: string | null
    thesis: string | null
    icp: string[] | null
    competitors: string[] | null
    differentiators: string | null
    priorities: string[] | null
    risks: string[] | null
  } | null
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20">
          <Icon className="h-4 w-4 text-indigo-400" />
        </div>
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Pill({ text }: { text: string }) {
  return (
    <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
      {text}
    </span>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-white/70">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-indigo-400" />
          {item}
        </li>
      ))}
    </ul>
  )
}

export default function PreviewPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<WorkspacePreview | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/preview/${token}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json() as Promise<WorkspacePreview>
      })
      .then((d) => { if (d) setData(d) })
      .catch(() => setNotFound(true))
  }, [token])

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-center">
          <Lock className="h-10 w-10 text-white/30 mx-auto mb-3" />
          <p className="text-white/50 text-sm">This preview link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    )
  }

  const { workspace, profile } = data
  const companyName = profile?.company_name ?? workspace.companyName ?? workspace.displayName

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold">
            {companyName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{companyName}</p>
            <p className="text-xs text-white/40">Workspace preview</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
          Read-only
        </Badge>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Hero */}
        <div className="text-center py-6">
          <h1 className="text-3xl font-bold text-white mb-2">{companyName}</h1>
          {profile?.tagline && (
            <p className="text-white/60 text-lg max-w-xl mx-auto">{profile.tagline}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {profile?.stage && <Pill text={profile.stage} />}
            {profile?.industry && <Pill text={profile.industry} />}
            {workspace.contextStatus === "ready" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                Context ready
              </span>
            )}
          </div>
        </div>

        {profile ? (
          <>
            {/* Problem + Solution */}
            {(profile.problem || profile.solution) && (
              <div className="grid gap-4 md:grid-cols-2">
                {profile.problem && (
                  <Section icon={Zap} title="Problem">
                    <p className="text-sm text-white/70 leading-relaxed">{profile.problem}</p>
                  </Section>
                )}
                {profile.solution && (
                  <Section icon={Shield} title="Solution">
                    <p className="text-sm text-white/70 leading-relaxed">{profile.solution}</p>
                  </Section>
                )}
              </div>
            )}

            {/* Description / Thesis */}
            {(profile.company_description || profile.thesis) && (
              <Section icon={Target} title="Company thesis">
                <p className="text-sm text-white/70 leading-relaxed">
                  {profile.thesis ?? profile.company_description}
                </p>
              </Section>
            )}

            {/* ICP */}
            {profile.icp && profile.icp.length > 0 && (
              <Section icon={Users} title="Target customer">
                <BulletList items={profile.icp} />
              </Section>
            )}

            {/* Traction */}
            {profile.traction && (
              <Section icon={TrendingUp} title="Traction">
                <p className="text-sm text-white/70 leading-relaxed">{profile.traction}</p>
              </Section>
            )}

            {/* Differentiators */}
            {profile.differentiators && (
              <Section icon={Shield} title="Why us">
                <p className="text-sm text-white/70 leading-relaxed">{profile.differentiators}</p>
              </Section>
            )}

            {/* Priorities */}
            {profile.priorities && profile.priorities.length > 0 && (
              <Section icon={CheckCircle2} title="90-day priorities">
                <BulletList items={profile.priorities} />
              </Section>
            )}

            {/* Competitors row */}
            {profile.competitors && profile.competitors.length > 0 && (
              <Section icon={Target} title="Competitive landscape">
                <div className="flex flex-wrap gap-2">
                  {profile.competitors.map((c, i) => (
                    <Pill key={i} text={c} />
                  ))}
                </div>
              </Section>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-white/40 text-sm">
            Context not yet submitted. The founder is still filling in details.
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-white/10 pt-6 text-center text-xs text-white/30">
          Powered by Juno · This is a read-only preview shared by {workspace.contactName ?? "the workspace owner"}
        </div>
      </div>
    </div>
  )
}

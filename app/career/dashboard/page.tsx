import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Newspaper, Brain, TrendingUp, ArrowRight, CheckCircle2, Clock } from "lucide-react"

export default async function CareerDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/career")

  const [{ data: profile }, { data: settings }, { data: skills }] = await Promise.all([
    supabase
      .schema("careeros")
      .from("user_profiles")
      .select("current_role_title,target_role_title,location_label,years_experience")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .schema("careeros")
      .from("user_settings")
      .select("onboarding_state")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .schema("careeros")
      .from("user_skills")
      .select("skill_name,current_status")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(5),
  ])

  const onboardingState = (settings?.onboarding_state as Record<string, unknown> | null) ?? {}
  const module11 = (onboardingState.module_1_1 as Record<string, unknown> | null) ?? {}
  const onboardingComplete = module11.module_1_1_complete === true

  const modules = [
    {
      title: "AI Updates Feed",
      description: "Personalised AI and market intelligence, filtered to your skills and role.",
      href: "/careeros/feed",
      icon: Newspaper,
      live: true,
    },
    {
      title: "Skill Portfolio",
      description: "Your skill half-life tracker — rising, stable, declining, at-risk.",
      href: "/careeros/skills",
      icon: Brain,
      live: true,
    },
    {
      title: "Market Intelligence",
      description: "Demand trends, salary bands, and adjacent roles for your function.",
      href: "/careeros/market",
      icon: TrendingUp,
      live: true,
    },
  ]

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Career OS</p>
        <h1 className="text-2xl font-semibold text-foreground">
          {profile?.current_role_title ? `Welcome back` : "Welcome"}
        </h1>
        {profile?.current_role_title && (
          <p className="text-sm text-muted-foreground mt-1">
            {profile.current_role_title}
            {profile.target_role_title ? ` → ${profile.target_role_title}` : ""}
            {profile.location_label ? ` · ${profile.location_label}` : ""}
          </p>
        )}
      </div>

      {/* Onboarding nudge if incomplete */}
      {!onboardingComplete && (
        <Link
          href="/careeros/onboarding"
          className="flex items-center justify-between rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Complete your profile</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Upload your resume and confirm your role to unlock personalised intelligence.
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 ml-4" />
        </Link>
      )}

      {/* Module cards */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Your workspace</p>
        <div className="grid gap-3">
          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <mod.icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{mod.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-4" />
            </Link>
          ))}
        </div>
      </div>

      {/* Skill snapshot — only if data exists */}
      {skills && skills.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Skill snapshot</p>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {skills.map((s) => (
              <div key={s.skill_name} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-foreground">{s.skill_name}</span>
                {s.current_status && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    s.current_status === "rising"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : s.current_status === "stable"
                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                        : s.current_status === "declining"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "bg-red-500/10 text-red-700 dark:text-red-400"
                  }`}>
                    {s.current_status}
                  </span>
                )}
              </div>
            ))}
            <div className="px-5 py-3">
              <Link
                href="/careeros/skills"
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                Full portfolio <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {onboardingComplete && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Profile active · Intelligence updating daily
        </div>
      )}
    </div>
  )
}

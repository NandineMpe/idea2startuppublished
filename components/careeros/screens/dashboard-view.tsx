import Link from "next/link"
import type { CareerDashboardContext } from "@/lib/careeros/dashboard/load-career-dashboard"
import {
  DEMO_FEED,
  DEMO_HEALTH,
  DEMO_MARKET,
  DEMO_SKILLS,
  JUNO_DASHBOARD_READ,
} from "@/lib/careeros/demo-data"
import { CareerOsIcon } from "@/components/careeros/icon"
import {
  CareerOsBtn,
  CareerOsMeter,
  CareerOsPill,
  CareerOsRowLink,
  CareerOsSectionHeader,
  CareerOsSparkline,
  CareerOsStat,
} from "@/components/careeros/ui"
import { MiniPillarRadial } from "@/components/careeros/mini-pillar-radial"

function firstNameFromHeadline(headline: string | null): string {
  if (!headline) return "there"
  const m = headline.match(/^([A-Z][a-z]+)/)
  return m?.[1] ?? "there"
}

export function CareerDashboardView({
  ctx,
  userName,
  locationLabel,
}: {
  ctx: CareerDashboardContext
  userName?: string | null
  locationLabel?: string | null
}) {
  const welcomeName = userName?.split(/\s+/)[0] ?? firstNameFromHeadline(ctx.profileHeadline)
  const loc = locationLabel ?? ctx.profile?.location_label ?? "London, UK"

  const topSkills =
    ctx.skills.length > 0
      ? ctx.skills.slice(0, 5).map((s, i) => {
          const demo = DEMO_SKILLS.find(
            (d) => d.name.toLowerCase() === s.skill_name.toLowerCase(),
          )
          return {
            name: s.skill_name,
            status: (s.current_status ?? demo?.status ?? "stable") as string,
            level: demo?.level ?? 70 - i * 3,
            halflife: demo?.halflife ?? 30,
            trend: demo?.trend ?? [60, 62, 64, 66, 68, 70, 70, 70, 70, 70],
          }
        })
      : DEMO_SKILLS.slice()
          .sort((a, b) => b.level - a.level)
          .slice(0, 5)

  const modules = [
    {
      id: "feed",
      title: "AI Updates Feed",
      icon: "news" as const,
      route: "/careeros/feed",
      desc: "Personalised AI and market intelligence, filtered to your skills and role.",
      badge: "12 new",
    },
    {
      id: "skills",
      title: "Skill Portfolio",
      icon: "brain" as const,
      route: "/careeros/skills",
      desc: "Your skill half-life tracker — rising, stable, declining, at-risk.",
    },
    {
      id: "market",
      title: "Market Intelligence",
      icon: "trending" as const,
      route: "/careeros/market",
      desc: "Demand trends, salary bands, and adjacent roles for your function.",
    },
    {
      id: "health",
      title: "Career Health Report",
      icon: "heart" as const,
      route: "/careeros/health-report",
      desc: "Quarterly narrative across five pillars, with linked next steps.",
      badge: "Updated 2d",
    },
  ]

  return (
    <div className="page-enter">
      <div className="career-os-split">
        <div>
          <header style={{ marginBottom: 28 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Career OS · {loc}
            </div>
            <h1 className="h-display">Welcome back, {welcomeName}.</h1>
            {ctx.profileHeadline && (
              <p className="body" style={{ marginTop: 10, maxWidth: "72ch" }}>
                {ctx.profileHeadline}
              </p>
            )}
            {ctx.profileSubtitle && (
              <p className="small" style={{ marginTop: 8, color: "hsl(var(--destructive))" }}>
                {ctx.profileSubtitle}
              </p>
            )}
          </header>

          {!ctx.onboardingComplete && (
            <Link
              href="/careeros/onboarding"
              className="card padded"
              style={{ marginBottom: 22, display: "block", borderColor: "hsl(var(--destructive) / 0.35)" }}
            >
              <p className="h-card">Complete your profile</p>
              <p className="body" style={{ marginTop: 6 }}>
                Upload your resume and confirm your role to unlock personalised intelligence.
              </p>
            </Link>
          )}

          <div className="card padded juno-halo" style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: "hsl(var(--primary))",
                  color: "white",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                J
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                  <span className="eyebrow" style={{ letterSpacing: "0.06em" }}>
                    This week, in your world
                  </span>
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: "hsl(var(--primary))",
                    }}
                  />
                  <span className="micro">Last refresh · 2 hours ago</span>
                </div>
                <p
                  className="body"
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "hsl(var(--foreground) / 0.92)",
                    marginBottom: 12,
                  }}
                >
                  {JUNO_DASHBOARD_READ}
                </p>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="micro" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <CareerOsIcon name="news" size={11} /> <span className="mono">12</span> new feed items
                  </span>
                  <CareerOsBtn href="/careeros" sm className="!ml-auto">
                    Open workspace <CareerOsIcon name="arrow_right" size={13} />
                  </CareerOsBtn>
                </div>
              </div>
            </div>
          </div>

          <CareerOsSectionHeader title="Your workspace" right={<span className="micro">4 modules</span>} />
          <div className="career-os-module-grid" style={{ marginBottom: 32 }}>
            {modules.map((mod) => (
              <CareerOsRowLink
                key={mod.id}
                href={mod.route}
                icon={mod.icon}
                title={mod.title}
                sub={mod.desc}
                badge={mod.badge}
              />
            ))}
          </div>

          <CareerOsSectionHeader
            title="Skill snapshot"
            right={
              <CareerOsBtn href="/careeros/skills" ghost sm>
                Full portfolio <CareerOsIcon name="arrow_right" size={12} />
              </CareerOsBtn>
            }
          />
          <div className="card">
            {topSkills.map((s) => (
              <div className="row" key={s.name}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{s.name}</span>
                    <CareerOsPill tone={s.status}>{s.status}</CareerOsPill>
                  </div>
                  <CareerOsMeter value={s.level} tone={s.status} size="sm" />
                </div>
                <div
                  style={{
                    width: 80,
                    flexShrink: 0,
                    color: `hsl(var(--status-${s.status === "at-risk" ? "risk" : s.status}))`,
                  }}
                >
                  <CareerOsSparkline data={s.trend} />
                </div>
                <div className="micro" style={{ width: 60, textAlign: "right" }}>
                  HL {s.halflife}mo
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card padded">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
              <div className="eyebrow">Career Health · Q2</div>
              <CareerOsPill tone="rising">
                <CareerOsIcon name="arrow_up" size={10} /> +{DEMO_HEALTH.delta} qtr
              </CareerOsPill>
            </div>
            <div style={{ display: "grid", placeItems: "center", margin: "6px 0 4px" }}>
              <MiniPillarRadial pillars={DEMO_HEALTH.pillars} overall={DEMO_HEALTH.overall} />
            </div>
            <p className="body" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
              <strong>Mid-pivot, in the timing window.</strong> Direction is your strongest pillar. The AI
              Governance cluster is doing the lift on Skills.
            </p>
            <hr className="div" style={{ margin: "12px 0" }} />
            <CareerOsBtn href="/careeros/health-report" primary sm className="!mt-3.5 !w-full !justify-center">
              Open full report <CareerOsIcon name="arrow_right" size={13} />
            </CareerOsBtn>
          </div>

          <div className="card padded">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Target role
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {ctx.profile?.target_role_title ?? DEMO_MARKET.role_title}
            </div>
            <div className="small" style={{ marginTop: 4 }}>
              From {ctx.profile?.current_role_title ?? DEMO_MARKET.current_role_title}
            </div>
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <CareerOsStat
                label="Demand index"
                value={DEMO_MARKET.demand_index}
                delta={DEMO_MARKET.demand_change_90d}
                sub="vs 90d ago"
                tone="primary"
              />
              <CareerOsStat
                label="Salary p50"
                value={`£${Math.round(DEMO_MARKET.salary.p50 / 1000)}k`}
                sub="London median"
              />
            </div>
            <CareerOsBtn href="/careeros/market" sm className="!mt-3 !w-full !justify-center">
              Market intel <CareerOsIcon name="arrow_right" size={13} />
            </CareerOsBtn>
          </div>

          <div className="card padded">
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Pinned
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {DEMO_FEED[0].items.slice(0, 2).map((it) => (
                <div key={it.title}>
                  <div className="micro" style={{ marginBottom: 3 }}>
                    {it.source} · {it.kind} · {it.time}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 500 }}>{it.title}</div>
                </div>
              ))}
            </div>
            <CareerOsBtn href="/careeros/feed" ghost sm className="!mt-2.5 !p-0">
              Open feed <CareerOsIcon name="arrow_right" size={12} />
            </CareerOsBtn>
          </div>
        </aside>
      </div>
    </div>
  )
}

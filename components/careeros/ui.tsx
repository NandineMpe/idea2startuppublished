import type { ReactNode } from "react"
import Link from "next/link"
import { CareerOsIcon, type CareerOsIconName } from "@/components/careeros/icon"

export function CareerOsPill({
  children,
  tone,
  solid,
  className,
}: {
  children: ReactNode
  tone?: string
  solid?: boolean
  className?: string
}) {
  const cls = ["pill"]
  if (solid) cls.push("solid")
  if (tone) cls.push(tone)
  if (className) cls.push(className)
  return <span className={cls.join(" ")}>{children}</span>
}

export function CareerOsPageHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: string
  title: string
  sub?: string
  actions?: ReactNode
}) {
  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 28,
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 280px" }}>
        {eyebrow && (
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {eyebrow}
          </div>
        )}
        <h1 className="h-display">{title}</h1>
        {sub && (
          <p className="body" style={{ marginTop: 10, maxWidth: "min(72ch, 100%)" }}>
            {sub}
          </p>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{actions}</div>}
    </header>
  )
}

export function CareerOsSectionHeader({
  title,
  right,
  sub,
}: {
  title: string
  right?: ReactNode
  sub?: string
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 14,
      }}
    >
      <div>
        <div className="h-section">{title}</div>
        {sub && <div className="small" style={{ marginTop: 4 }}>{sub}</div>}
      </div>
      {right && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{right}</div>}
    </div>
  )
}

export function CareerOsStat({
  label,
  value,
  delta,
  sub,
  tone,
}: {
  label: string
  value: ReactNode
  delta?: number | null
  sub?: string
  tone?: "primary"
}) {
  const deltaTone =
    delta == null ? null : delta > 0 ? "rising" : delta < 0 ? "declining" : "stable"
  return (
    <div>
      <div className="micro" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: tone === "primary" ? "hsl(var(--primary))" : undefined,
          }}
        >
          {value}
        </div>
        {delta != null && (
          <CareerOsPill tone={deltaTone ?? undefined}>
            <CareerOsIcon name={delta >= 0 ? "arrow_up" : "arrow_down"} size={11} />
            {delta > 0 ? `+${delta}` : delta}%
          </CareerOsPill>
        )}
      </div>
      {sub && (
        <div className="micro" style={{ marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

export function CareerOsMeter({
  value = 0,
  max = 100,
  tone = "primary",
  size = "md",
}: {
  value?: number
  max?: number
  tone?: string
  size?: "sm" | "md" | "lg"
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const toneVar: Record<string, string> = {
    primary: "var(--primary)",
    rising: "var(--status-rising)",
    stable: "var(--status-stable)",
    declining: "var(--status-declining)",
    "at-risk": "var(--status-risk)",
  }
  const bg = toneVar[tone] ?? "var(--primary)"
  const sizeClass = size === "sm" ? "thin" : size === "lg" ? "thick" : ""
  return (
    <div className={`meter ${sizeClass}`}>
      <div className="fill" style={{ width: `${pct}%`, background: `hsl(${bg})` }} />
    </div>
  )
}

export function CareerOsSparkline({
  data = [],
  width = 80,
  height = 22,
}: {
  data?: number[]
  width?: number
  height?: number
}) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 2) + 1
    const y = height - 1 - ((v - min) / span) * (height - 2)
    return [x, y] as const
  })
  const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ")
  return (
    <svg width={width} height={height} className="spark" viewBox={`0 0 ${width} ${height}`}>
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CareerOsRowLink({
  href,
  icon,
  title,
  sub,
  badge,
}: {
  href: string
  icon: CareerOsIconName
  title: string
  sub: string
  badge?: string
}) {
  return (
    <Link href={href} className="row-link">
      <div className="icon-tile">
        <CareerOsIcon name={icon} size={17} />
      </div>
      <div className="copy">
        <div className="title">{title}</div>
        <div className="sub">{sub}</div>
      </div>
      {badge && <CareerOsPill solid>{badge}</CareerOsPill>}
      <CareerOsIcon name="chevron_right" size={16} className="chev" />
    </Link>
  )
}

export function CareerOsBtn({
  children,
  primary,
  ghost,
  sm,
  className,
  href,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode
  primary?: boolean
  ghost?: boolean
  sm?: boolean
  className?: string
  href?: string
  onClick?: () => void
  disabled?: boolean
  type?: "button" | "submit"
}) {
  const cls = ["btn"]
  if (primary) cls.push("primary")
  if (ghost) cls.push("ghost")
  if (sm) cls.push("sm")
  if (className) cls.push(className)
  const combined = cls.join(" ")
  if (href) {
    return (
      <Link href={href} className={combined}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={combined} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

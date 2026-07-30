"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CareerOsIcon } from "@/components/careeros/icon"
import { useCareerDisplayIdentity } from "@/components/careeros/use-career-display-identity"
import { JunoBlueDotMark } from "@/components/juno/blue-dot-mark"
import {
  CAREER_OS_ROUTES,
  isCareerOsNavActive,
  type CareerOsRoute,
} from "@/components/careeros/career-os-routes"
function NavLink({ route, active }: { route: CareerOsRoute; active: boolean }) {
  return (
    <Link href={route.path} className={`nav-item ${active ? "active" : ""}`}>
      <CareerOsIcon name={route.icon} size={16} className="nav-icon" />
      <span>{route.label}</span>
      {route.badge && <span className="nav-badge">{route.badge}</span>}
    </Link>
  )
}

export function CareerSidebar() {
  const pathname = usePathname() ?? ""
  const { name, email, initials } = useCareerDisplayIdentity()

  const careerLinks = CAREER_OS_ROUTES.filter((r) => r.section === "career")
  const careerosLinks = CAREER_OS_ROUTES.filter((r) => r.section === "careeros")

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <JunoBlueDotMark className="h-3 w-3" />
        </div>
        <div className="brand-name">Juno - CareerOS</div>
      </div>

      <div className="nav-section">
        <div className="nav-heading">Career</div>
        {careerLinks.map((r) => (
          <NavLink key={r.path} route={r} active={isCareerOsNavActive(pathname, r)} />
        ))}
      </div>

      <div className="nav-section flex-1 overflow-y-auto scrollbar-auto-hide">
        <div className="nav-heading">CareerOS</div>
        {careerosLinks.map((r) => (
          <NavLink key={r.path} route={r} active={isCareerOsNavActive(pathname, r)} />
        ))}
      </div>

      <div className="sidebar-foot">
        <Link href="/career/dashboard/settings" className="nav-item">
          <CareerOsIcon name="settings" size={16} className="nav-icon" />
          <span>Settings</span>
        </Link>
        <Link href="/" className="nav-item">
          <CareerOsIcon name="layers" size={16} className="nav-icon" />
          <span>Switch OS</span>
        </Link>
        <div className="user-card">
          <div className="avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name truncate">{name}</div>
            {email ? <div className="user-mail truncate">{email}</div> : null}
          </div>
        </div>
      </div>
    </aside>
  )
}

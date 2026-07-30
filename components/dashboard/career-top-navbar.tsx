"use client"

import { usePathname } from "next/navigation"
import { CareerOsIcon } from "@/components/careeros/icon"
import { CareerOsBtn } from "@/components/careeros/ui"
import { matchCareerOsRoute } from "@/components/careeros/career-os-routes"

type CareerTopNavbarProps = {
  onOpenBrainChat?: () => void
}

export function CareerTopNavbar({ onOpenBrainChat }: CareerTopNavbarProps) {
  const pathname = usePathname() ?? ""
  const route = matchCareerOsRoute(pathname)

  return (
    <div className="topbar">
      <div className="crumbs">
        {route.crumb.map((c, i) => (
          <span key={c} style={{ display: "contents" }}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === route.crumb.length - 1 ? "here" : ""}>{c}</span>
          </span>
        ))}
      </div>
      <div className="top-actions">
        <button
          type="button"
          className="icon-btn"
          title="Open Juno CareerOS voice"
          onClick={onOpenBrainChat}
        >
          <CareerOsIcon name="brain" size={16} />
        </button>
        <button type="button" className="icon-btn has-badge" title="Notifications">
          <CareerOsIcon name="bell" size={16} />
        </button>
        <CareerOsBtn href="/careeros/health-report" sm>
          <CareerOsIcon name="sparkles" size={13} /> New report
        </CareerOsBtn>
      </div>
    </div>
  )
}

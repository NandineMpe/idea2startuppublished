"use client"

import type React from "react"
import {
  Compass,
  DollarSign,
  Fingerprint,
  FileVideo,
  Handshake,
  Lightbulb,
  Newspaper,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Sunrise,
  Layers,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"

type NavItem = {
  title: string
  href: string
  icon: React.ElementType
  exact?: boolean
}

// Every entry resolves to a real route. Nothing is listed here before it exists.
const navItems: NavItem[] = [
  { title: "The Desk", href: "/creator/dashboard", icon: Sunrise, exact: true },
  // Above Canon deliberately: where you are going should be easier to reach
  // than where you have been.
  { title: "Trajectory", href: "/creator/dashboard/trajectory", icon: Compass },
  { title: "Stories", href: "/creator/dashboard/stories", icon: Newspaper },
  { title: "Opportunities", href: "/creator/dashboard/opportunities", icon: Handshake },
  { title: "Next Five", href: "/creator/dashboard/next", icon: Lightbulb },
  { title: "Worth", href: "/creator/dashboard/worth", icon: DollarSign },
  { title: "Canon", href: "/creator/dashboard/canon", icon: Fingerprint },
  { title: "Content", href: "/creator/dashboard/content", icon: FileVideo },
]

export function CreatorSidebar() {
  const pathname = usePathname() ?? ""
  const [expanded, setExpanded] = useState(true)

  return (
    <aside
      className={cn(
        "h-full flex flex-col border-r border-border bg-card transition-all duration-200",
        expanded ? "w-[220px]" : "w-[52px]",
      )}
    >
      <div className={cn(
        "flex items-center gap-3 border-b border-border shrink-0",
        expanded ? "px-4 py-4" : "px-2 py-4 justify-center"
      )}>
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
          <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </div>
        {expanded && (
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate">Juno</p>
            <p className="text-[11px] text-muted-foreground truncate">Creator workspace</p>
          </div>
        )}
        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      <nav className={cn("flex-1 overflow-y-auto scrollbar-auto-hide py-2 space-y-px", expanded ? "px-2" : "px-1")}>
        {navItems.map((navItem) => {
          const isActive = navItem.exact
            ? pathname === navItem.href
            : pathname === navItem.href || pathname.startsWith(navItem.href + "/")

          return (
            <Link
              key={navItem.href}
              href={navItem.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
                expanded ? "px-2.5 py-[7px]" : "px-0 py-[7px] justify-center",
                isActive
                  ? "bg-violet-500/10 text-violet-700 dark:text-violet-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
              title={expanded ? undefined : navItem.title}
            >
              <navItem.icon
                className={cn(
                  "shrink-0",
                  isActive ? "text-violet-600 dark:text-violet-400" : "",
                  expanded ? "h-4 w-4" : "h-[18px] w-[18px]",
                )}
              />
              {expanded && <span className="truncate">{navItem.title}</span>}
            </Link>
          )
        })}
      </nav>

      <div className={cn("border-t border-border shrink-0", expanded ? "p-2" : "p-1")}>
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center justify-center w-full py-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent mb-1"
          >
            <PanelLeftOpen size={15} />
          </button>
        )}
        <div className="space-y-px">
          <Link
            href="/creator/dashboard/settings"
            className={cn(
              "flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
              expanded ? "px-2.5 py-[7px]" : "px-0 py-[7px] justify-center",
              pathname === "/creator/dashboard/settings"
                ? "bg-violet-500/10 text-violet-700 dark:text-violet-400"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            title={expanded ? undefined : "Settings"}
          >
            <Settings className={cn("shrink-0", expanded ? "h-4 w-4" : "h-[18px] w-[18px]")} />
            {expanded && <span>Settings</span>}
          </Link>
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent",
              expanded ? "px-2.5 py-[7px]" : "px-0 py-[7px] justify-center",
            )}
            title={expanded ? undefined : "All modes"}
          >
            <Layers className={cn("shrink-0", expanded ? "h-4 w-4" : "h-[18px] w-[18px]")} />
            {expanded && <span>All modes</span>}
          </Link>
        </div>
      </div>
    </aside>
  )
}

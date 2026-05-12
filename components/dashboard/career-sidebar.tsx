"use client"

import type React from "react"
import { Briefcase, Newspaper, Brain, TrendingUp, Settings, PanelLeftClose, PanelLeftOpen, Layers } from "lucide-react"
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

const navItems: NavItem[] = [
  { title: "Home", href: "/career/dashboard", icon: Briefcase, exact: true },
  { title: "AI Feed", href: "/careeros/feed", icon: Newspaper },
  { title: "Skill Portfolio", href: "/careeros/skills", icon: Brain },
  { title: "Market", href: "/careeros/market", icon: TrendingUp },
]

export function CareerSidebar() {
  const pathname = usePathname() ?? ""
  const [expanded, setExpanded] = useState(true)

  return (
    <aside
      className={cn(
        "h-full flex flex-col border-r border-border bg-card transition-all duration-200",
        expanded ? "w-[200px]" : "w-[52px]",
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 border-b border-border shrink-0",
        expanded ? "px-4 py-4" : "px-2 py-4 justify-center"
      )}>
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Briefcase className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        {expanded && (
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate">Career OS</p>
            <p className="text-[11px] text-muted-foreground truncate">Beta</p>
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

      {/* Nav */}
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
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
              title={expanded ? undefined : navItem.title}
            >
              <navItem.icon
                className={cn(
                  "shrink-0",
                  isActive ? "text-emerald-600 dark:text-emerald-400" : "",
                  expanded ? "h-4 w-4" : "h-[18px] w-[18px]",
                )}
              />
              {expanded && <span className="truncate">{navItem.title}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
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
            href="/career/dashboard/settings"
            className={cn(
              "flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
              expanded ? "px-2.5 py-[7px]" : "px-0 py-[7px] justify-center",
              pathname === "/career/dashboard/settings"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
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
            title={expanded ? undefined : "Switch OS"}
          >
            <Layers className={cn("shrink-0", expanded ? "h-4 w-4" : "h-[18px] w-[18px]")} />
            {expanded && <span>Switch OS</span>}
          </Link>
        </div>
      </div>
    </aside>
  )
}

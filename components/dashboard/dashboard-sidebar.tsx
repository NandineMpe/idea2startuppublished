"use client"

import type React from "react"
import {
  Radio,
  Target,
  Layers,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  Share2,
  UserCircle,
  Plug,
  Shield,
  Coffee,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useContext, createContext } from "react"
import { cn } from "@/lib/utils"
import { OrganizationSwitcher } from "@/components/dashboard/organization-switcher"

type NavItem = {
  title: string
  href: string
  icon: React.ElementType
  exact?: boolean
}

const navItems: NavItem[] = [
  { title: "Intelligence Feed", href: "/dashboard", icon: Radio, exact: true },
  { title: "Command Center", href: "/dashboard/command", icon: Target },
  { title: "Security updates", href: "/dashboard/security-updates", icon: Shield },
  { title: "Office Hours", href: "/dashboard/office-hours", icon: Coffee },
  { title: "GTM", href: "/dashboard/distribution", icon: Share2 },
  { title: "Founder brand", href: "/dashboard/founder-brand", icon: UserCircle },
]

const SidebarContext = createContext<{
  expanded: boolean
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>
}>({
  expanded: true,
  setExpanded: () => {},
})

export function useSidebar() {
  return useContext(SidebarContext)
}

export function DashboardSidebar() {
  const pathname = usePathname() ?? ""
  const [expanded, setExpanded] = useState(true)

  return (
    <SidebarContext.Provider value={{ expanded, setExpanded }}>
      <aside
        className={cn(
          "h-full flex flex-col border-r border-border bg-card transition-all duration-200",
          expanded ? "w-[220px]" : "w-[52px]",
        )}
      >
        {/* Workspace Header */}
        <div className={cn(
          "flex items-center gap-3 border-b border-border shrink-0",
          expanded ? "px-4 py-4" : "px-2 py-4 justify-center"
        )}>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          {expanded && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">Juno</p>
              <p className="text-[11px] text-muted-foreground truncate">Intelligence workspace</p>
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

        <OrganizationSwitcher expanded={expanded} />

        {/* Navigation */}
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
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
                title={expanded ? undefined : navItem.title}
              >
                <navItem.icon
                  className={cn(
                    "shrink-0",
                    isActive ? "text-primary" : "",
                    expanded ? "h-4 w-4" : "h-[18px] w-[18px]",
                  )}
                />
                {expanded && <span className="truncate">{navItem.title}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
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
            href="/dashboard/context"
            className={cn(
              "flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
              expanded ? "px-2.5 py-[7px]" : "px-0 py-[7px] justify-center",
              pathname === "/dashboard/context" || pathname.startsWith("/dashboard/context/")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            title={expanded ? undefined : "Context"}
          >
            <Layers className={cn("shrink-0", expanded ? "h-4 w-4" : "h-[18px] w-[18px]")} />
            {expanded && <span>Context</span>}
          </Link>
          <Link
            href="/dashboard/integrations"
            className={cn(
              "flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
              expanded ? "px-2.5 py-[7px]" : "px-0 py-[7px] justify-center",
              pathname === "/dashboard/integrations" || pathname.startsWith("/dashboard/integrations/")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            title={expanded ? undefined : "Integrations"}
          >
            <Plug className={cn("shrink-0", expanded ? "h-4 w-4" : "h-[18px] w-[18px]")} />
            {expanded && <span>Integrations</span>}
          </Link>
          <Link
            href="/dashboard/settings"
            className={cn(
              "flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
              expanded ? "px-2.5 py-[7px]" : "px-0 py-[7px] justify-center",
              pathname === "/dashboard/settings"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            title={expanded ? undefined : "Settings"}
          >
            <Settings className={cn("shrink-0", expanded ? "h-4 w-4" : "h-[18px] w-[18px]")} />
            {expanded && <span>Settings</span>}
          </Link>
          </div>
        </div>
      </aside>
    </SidebarContext.Provider>
  )
}

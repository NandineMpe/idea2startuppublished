"use client"

import type React from "react"
import {
  ChevronRight,
  Lightbulb,
  BookOpen,
  MessageSquare,
  FileText,
  BarChart3,
  PieChart,
  Users,
  Rocket,
  LayoutDashboard,
  TrendingUp,
  Target,
  GitBranch,
  Scale,
  Database,
  Settings,
  Search,
  Calendar,
  LineChart,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  Briefcase,
  FlaskConical,
  Megaphone,
  Wallet,
  Cog,
  UsersRound,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useContext, createContext } from "react"
import { cn } from "@/lib/utils"
import { PresentationIcon } from "lucide-react"

type NavItem = {
  title: string
  href: string
  icon: React.ElementType
}

type NavSection = {
  title: string
  roleSlug?: string
  icon: React.ElementType
  color?: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { title: "Knowledge base", href: "/dashboard/knowledge", icon: Database },
      { title: "Company Profile", href: "/dashboard/company", icon: Building2 },
      { title: "Strategic Command", href: "/dashboard/command", icon: Zap },
    ],
  },
  {
    title: "Your Team",
    icon: UsersRound,
    items: [{ title: "Team Overview", href: "/dashboard/team", icon: UsersRound }],
  },
  {
    title: "Chief Business Strategist",
    roleSlug: "cbs",
    icon: Briefcase,
    color: "text-amber-600",
    items: [
      { title: "Business Idea Analysis", href: "/dashboard/idea/analyser", icon: Lightbulb },
      { title: "Value Proposition", href: "/dashboard/idea/value-proposition", icon: Target },
      { title: "Business Model", href: "/dashboard/idea/business-model", icon: FileText },
      { title: "Opportunity Scanner", href: "/dashboard/market/opportunity-scanner", icon: Search },
    ],
  },
  {
    title: "Chief Research Officer",
    roleSlug: "cro",
    icon: FlaskConical,
    color: "text-sky-600",
    items: [
      { title: "Consumer & Market Insights", href: "/dashboard/idea/market-insights", icon: BarChart3 },
      { title: "Competitor Analysis", href: "/dashboard/idea/competitor-analysis", icon: Users },
      { title: "Advanced Competition", href: "/dashboard/scale/competition", icon: Target },
      { title: "Domain Knowledge", href: "/dashboard/knowledge/domain", icon: BookOpen },
      { title: "Feedback & Insights", href: "/dashboard/knowledge/feedback", icon: MessageSquare },
    ],
  },
  {
    title: "Chief Marketing Officer",
    roleSlug: "cmo",
    icon: Megaphone,
    color: "text-rose-500",
    items: [
      { title: "Go-To-Market Strategy", href: "/dashboard/market/strategy", icon: Rocket },
      { title: "Pitch Vault", href: "/dashboard/pitch", icon: PresentationIcon },
      { title: "Founder's Journey", href: "/dashboard/knowledge/founders-journey", icon: TrendingUp },
      { title: "Global Startup Events", href: "/dashboard/scale/events", icon: Calendar },
      { title: "Internationalisation", href: "/dashboard/scale/international", icon: Globe },
    ],
  },
  {
    title: "Chief Financial Officer",
    roleSlug: "cfo",
    icon: Wallet,
    color: "text-emerald-600",
    items: [
      { title: "Financial Engineering", href: "/dashboard/scale/financial", icon: LineChart },
      { title: "Funding Readiness", href: "/dashboard/market/funding-score", icon: Target },
      { title: "Funding Strategy", href: "/dashboard/market/funding-strategy", icon: Settings },
      { title: "Cap Table", href: "/dashboard/scale/cap-table", icon: PieChart },
      { title: "Startup Credits", href: "/dashboard/scale/credits", icon: Database },
    ],
  },
  {
    title: "Chief Operating Officer",
    roleSlug: "coo",
    icon: Cog,
    color: "text-violet-600",
    items: [
      { title: "LLC Formation", href: "/dashboard/market/llc-formation", icon: FileText },
      { title: "Legal Requirements", href: "/dashboard/market/legal", icon: Scale },
      { title: "Recruiting Agent", href: "/dashboard/scale/recruiting", icon: Users },
      { title: "Full Business Plan", href: "/dashboard/scale/business-plan", icon: FileText },
      { title: "Product Roadmap", href: "/dashboard/idea/roadmap", icon: GitBranch },
    ],
  },
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
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "Chief Business Strategist": true,
    "Chief Research Officer": false,
    "Chief Marketing Officer": false,
    "Chief Financial Officer": false,
    "Chief Operating Officer": false,
  })

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  const sectionHasActive = (section: NavSection) =>
    section.items.some((item) => pathname === item.href)

  return (
    <SidebarContext.Provider value={{ expanded, setExpanded }}>
      <aside
        className={cn(
          "h-full flex flex-col border-r border-border bg-card transition-all duration-200",
          expanded ? "w-[260px]" : "w-[52px]",
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
              <p className="text-[13px] font-semibold text-foreground truncate">IdeaToStartup</p>
              <p className="text-[11px] text-muted-foreground truncate">Startup workspace</p>
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

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto scrollbar-auto-hide py-2", expanded ? "px-2" : "px-1")}>
          {navSections.map((section) => {
            const isTopLevel = section.title === "Dashboard" || section.title === "Your Team"

            if (isTopLevel) {
              return (
                <div key={section.title} className="mb-1 space-y-px">
                  {section.items.map((navItem) => {
                    const isActive =
                      pathname === navItem.href ||
                      (navItem.href !== "/dashboard" && pathname.startsWith(navItem.href + "/"))
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
                </div>
              )
            }

            const isExpanded = expandedSections[section.title]
            const hasActive = sectionHasActive(section)

            return (
              <div key={section.title} className="mt-1">
                <button
                  className={cn(
                    "flex items-center w-full rounded-md text-[13px] transition-colors group",
                    expanded ? "px-2.5 py-[7px] gap-2.5 justify-between" : "px-0 py-[7px] justify-center",
                    hasActive && !isExpanded
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                  onClick={() => expanded && toggleSection(section.title)}
                  title={expanded ? undefined : section.title}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <section.icon className={cn(section.color || "text-muted-foreground", expanded ? "h-4 w-4" : "h-[18px] w-[18px]")} />
                      {hasActive && !expanded && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                    {expanded && (
                      <span className="truncate font-medium">{section.title}</span>
                    )}
                  </div>
                  {expanded && (
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground/50 shrink-0 transition-transform duration-200",
                        isExpanded && "rotate-90"
                      )}
                    />
                  )}
                </button>

                {expanded && isExpanded && (
                  <div className="ml-[18px] pl-3 border-l border-border mt-0.5 mb-1 space-y-px">
                    {section.items.map((navItem) => {
                      const isActive = pathname === navItem.href
                      return (
                        <Link
                          key={navItem.title}
                          href={navItem.href}
                          className={cn(
                            "flex items-center gap-2 px-2 py-[6px] text-[13px] rounded-md transition-colors",
                            isActive
                              ? "text-primary font-medium bg-primary/5"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent",
                          )}
                        >
                          <navItem.icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "")} />
                          <span className="truncate">{navItem.title}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
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
          <Link
            href="/dashboard/settings"
            className={cn(
              "flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
              expanded ? "px-2.5 py-[7px]" : "px-0 py-[7px] justify-center",
              pathname === "/dashboard/settings"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            <Settings className={cn("shrink-0", expanded ? "h-4 w-4" : "h-[18px] w-[18px]")} />
            {expanded && <span>Settings</span>}
          </Link>
        </div>
      </aside>
    </SidebarContext.Provider>
  )
}

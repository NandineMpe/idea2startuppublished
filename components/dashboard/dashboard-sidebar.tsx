"use client"

import type React from "react"

import {
  ChevronDown,
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
  Briefcase,
  FlaskConical,
  Megaphone,
  Wallet,
  Cog,
  UserCircle,
  UsersRound,
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
    items: [{ title: "Command Center", href: "/dashboard", icon: LayoutDashboard }],
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
    color: "text-yellow-400",
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
    color: "text-blue-400",
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
    color: "text-pink-400",
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
    color: "text-emerald-400",
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
    color: "text-purple-400",
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
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

export function DashboardSidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Dashboard: true,
    "Your Team": false,
    "Chief Business Strategist": true,
    "Chief Research Officer": true,
    "Chief Marketing Officer": true,
    "Chief Financial Officer": true,
    "Chief Operating Officer": true,
  })

  const toggleExpanded = () => {
    setExpanded((prev) => !prev)
  }

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }))
  }

  return (
    <SidebarContext.Provider value={{ expanded, setExpanded }}>
      <aside
        className={cn(
          "h-full overflow-y-auto custom-scrollbar bg-black border-r border-primary/10 flex flex-col transition-all duration-300 relative",
          expanded ? "w-64" : "w-16",
        )}
      >
        <button
          onClick={toggleExpanded}
          className="absolute top-4 right-2 text-white/70 hover:text-primary transition-colors z-10"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>

        <div className="flex-1 py-4">
          {navSections.map((section) => {
            const isTopLevel = section.title === "Dashboard" || section.title === "Your Team"

            if (isTopLevel) {
              const mainItem = section.items[0]
              const isActive = pathname === mainItem.href
              return (
                <div key={section.title} className="px-4 py-1">
                  <Link
                    href={mainItem.href}
                    className={cn(
                      "flex items-center gap-2 py-2 font-medium transition-colors",
                      isActive ? "text-primary" : "text-white/80 hover:text-primary",
                    )}
                  >
                    <section.icon className="h-5 w-5" />
                    {expanded && <span>{mainItem.title}</span>}
                  </Link>
                </div>
              )
            }

            return (
              <div key={section.title} className="py-1">
                <button
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-2 text-sm font-medium transition-colors group",
                    !expanded && "justify-center",
                  )}
                  onClick={() => expanded && toggleSection(section.title)}
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <section.icon className={cn("h-5 w-5", section.color || "text-white/70")} />
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-black" />
                    </div>
                    {expanded && (
                      <div className="flex flex-col items-start">
                        <span className={cn("text-xs font-normal", section.color || "text-white/60")}>
                          {section.title}
                        </span>
                      </div>
                    )}
                  </div>
                  {expanded && (
                    <div className="flex items-center gap-1">
                      {section.roleSlug && (
                        <Link
                          href={`/dashboard/team/${section.roleSlug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                          title={`View ${section.title} profile`}
                        >
                          <UserCircle className="h-3.5 w-3.5 text-white/40 hover:text-primary" />
                        </Link>
                      )}
                      {expandedSections[section.title] ? (
                        <ChevronDown className="h-4 w-4 text-white/40" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                  )}
                </button>

                {expanded && expandedSections[section.title] && (
                  <div className="mt-1 space-y-0.5 px-4">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href
                      return (
                        <Link
                          key={item.title}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2 px-4 py-1.5 text-sm rounded-md transition-all",
                            isActive ? "text-primary font-medium bg-primary/5" : "text-white/70 hover:text-primary hover:bg-white/5",
                          )}
                        >
                          <item.icon className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-white/50")} />
                          <span>{item.title}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}

                {!expanded && (
                  <div className="mt-1 space-y-1 px-1">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href
                      return (
                        <Link
                          key={item.title}
                          href={item.href}
                          title={item.title}
                          className={cn(
                            "flex items-center justify-center py-2 text-sm rounded-md transition-all",
                            isActive ? "text-primary font-medium" : "text-white/80 hover:text-primary",
                          )}
                        >
                          <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-white/70")} />
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-auto border-t border-primary/10 py-4 px-4">
          <Link
            href="/dashboard/settings"
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-all",
              !expanded ? "justify-center" : "",
              pathname === "/dashboard/settings" ? "text-primary font-medium" : "text-white/80 hover:text-primary",
            )}
          >
            <Settings
              className={cn("h-4 w-4", pathname === "/dashboard/settings" ? "text-primary" : "text-white/70")}
            />
            {expanded && <span>Settings</span>}
          </Link>
        </div>
      </aside>
    </SidebarContext.Provider>
  )
}

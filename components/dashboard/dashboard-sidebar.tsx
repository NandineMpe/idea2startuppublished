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
  comingSoon?: boolean
  greyedOut?: boolean
}

type NavSection = {
  title: string
  icon: React.ElementType
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: "Main",
    icon: LayoutDashboard,
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Knowledge Bank",
    icon: BookOpen,
    items: [
      { title: "Founder's Journey", href: "/dashboard/knowledge/founders-journey", icon: Rocket },
      { title: "Domain Knowledge", href: "/dashboard/knowledge/domain", icon: FileText },
      { title: "Feedback & Insights", href: "/dashboard/knowledge/feedback", icon: MessageSquare },
    ],
  },
  {
    title: "Idea to Product",
    icon: Lightbulb,
    items: [
      { title: "Business Idea Analysis", href: "/dashboard/idea/analyser", icon: Lightbulb },
      { title: "Consumer and Market Insights", href: "/dashboard/idea/market-insights", icon: BarChart3 },
      { title: "Competitor Analysis", href: "/dashboard/idea/competitor-analysis", icon: Users },
      {
        title: "Value Proposition Generator",
        href: "/dashboard/idea/value-proposition",
        icon: Target,
        greyedOut: true,
      },
      { title: "Business Model Generator", href: "/dashboard/idea/business-model", icon: FileText, greyedOut: true },
      { title: "Product Roadmap Builder", href: "/dashboard/idea/roadmap", icon: GitBranch, greyedOut: true },
    ],
  },
  {
    title: "Product to Market",
    icon: TrendingUp,
    items: [
      { title: "LLC Formation Service", href: "/dashboard/market/llc-formation", icon: FileText, greyedOut: true },
      { title: "Startup Legal Requirements", href: "/dashboard/market/legal", icon: Scale, greyedOut: true },
      { title: "Go-To-Market Strategy", href: "/dashboard/market/strategy", icon: Rocket },
      { title: "Pitch Vault", href: "/dashboard/pitch", icon: PresentationIcon },
      { title: "Investor Database", href: "/dashboard/market/investors", icon: Database, greyedOut: true },
      { title: "Funding Readiness Score", href: "/dashboard/market/funding-score", icon: Target, greyedOut: true },
      {
        title: "Funding Strategy Optimizer",
        href: "/dashboard/market/funding-strategy",
        icon: Settings,
        greyedOut: true,
      },
      {
        title: "Business Opportunity Scanner",
        href: "/dashboard/market/opportunity-scanner",
        icon: Search,
        greyedOut: true,
      },
    ],
  },
  {
    title: "Market to Scale",
    icon: TrendingUp,
    items: [
      { title: "Startup Credits Database", href: "/dashboard/scale/credits", icon: Database, greyedOut: true },
      { title: "Global Startup Events 2025", href: "/dashboard/scale/events", icon: Calendar, greyedOut: true },
      { title: "Financial Engineering", href: "/dashboard/scale/financial", icon: LineChart, greyedOut: true },
      { title: "Recruiting Agent", href: "/dashboard/scale/recruiting", icon: Users, greyedOut: true },
      { title: "Advanced Competition Analyzer", href: "/dashboard/scale/competition", icon: Target, greyedOut: true },
      { title: "Internationalisation Strategy", href: "/dashboard/scale/international", icon: Globe, greyedOut: true },
      { title: "Full Business Plan", href: "/dashboard/scale/business-plan", icon: FileText, greyedOut: true },
      { title: "Cap Table Management", href: "/dashboard/scale/cap-table", icon: PieChart, greyedOut: true },
    ],
  },
]

// Create a context for the sidebar state
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
    Main: true,
    "Knowledge Bank": true,
    "Idea to Product": true,
    "Product to Market": true,
    "Market to Scale": true,
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
        {/* Toggle button at the top */}
        <button
          onClick={toggleExpanded}
          className="absolute top-4 right-2 text-white/70 hover:text-primary transition-colors z-10"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>

        <div className="flex-1 py-4">
          {navSections.map((section) => (
            <div key={section.title} className="py-1">
              {section.title === "Main" ? (
                <div className="px-4 py-2">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 text-primary font-medium hover:text-primary/90 transition-colors"
                  >
                    <LayoutDashboard className="h-5 w-5" />
                    {expanded && <span>Dashboard</span>}
                  </Link>
                </div>
              ) : (
                <>
                  <button
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-white hover:text-primary transition-colors",
                      !expanded && "justify-center",
                    )}
                    onClick={() => expanded && toggleSection(section.title)}
                  >
                    <div className="flex items-center gap-2">
                      <section.icon
                        className={`h-5 w-5 ${section.title === "Idea to Product" || section.title === "Product to Market" ? "text-primary" : "text-white/70"}`}
                      />
                      {expanded && (
                        <span
                          className={
                            section.title === "Idea to Product" || section.title === "Product to Market"
                              ? "text-primary"
                              : "text-white"
                          }
                        >
                          {section.title}
                        </span>
                      )}
                    </div>
                    {expanded &&
                      (expandedSections[section.title] ? (
                        <ChevronDown className="h-4 w-4 text-white/70" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-white/70" />
                      ))}
                  </button>

                  {expanded && expandedSections[section.title] && (
                    <div className="mt-1 space-y-1 px-4">
                      {section.items.map((item) => {
                        const isActive = pathname === item.href
                        return (
                          <div key={item.title} className="relative">
                            <Link
                              href={item.greyedOut ? "#" : item.href}
                              onClick={(e) => item.greyedOut && e.preventDefault()}
                              className={cn(
                                "flex items-center justify-between px-4 py-2 text-sm rounded-md transition-all",
                                isActive ? "text-primary font-medium" : "text-white/80 hover:text-primary",
                                item.greyedOut && "text-gray-500/70 hover:text-gray-500/70 cursor-not-allowed",
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-white/70")} />
                                <span>{item.title}</span>
                              </div>
                              {item.greyedOut && (
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">Soon</span>
                              )}
                            </Link>
                          </div>
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
                            href={item.greyedOut ? "#" : item.href}
                            onClick={(e) => item.greyedOut && e.preventDefault()}
                            title={`${item.title}${item.greyedOut ? " (Coming Soon)" : ""}`}
                            className={cn(
                              "flex items-center justify-center py-2 text-sm rounded-md transition-all",
                              isActive ? "text-primary font-medium" : "text-white/80 hover:text-primary",
                              item.greyedOut && "text-gray-500/70 hover:text-gray-500/70 cursor-not-allowed",
                            )}
                          >
                            <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-white/70")} />
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Settings link at the bottom */}
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

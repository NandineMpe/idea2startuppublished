"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ChevronDown, ChevronRight, Lightbulb, Settings, LayoutGrid, BookText, Rocket, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

export function DashboardSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(true) // Changed from false to true
  const [openSections, setOpenSections] = useState({
    "idea-to-product": true,
    "product-to-market": false,
    "knowledge-bank": false,
    "market-to-scale": false,
  })

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-20 flex h-full flex-col border-r border-gray-800 bg-black transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
      )}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
    >
      <div className="flex h-16 items-center justify-center px-4">
        <Link href="/dashboard" className="flex items-center justify-center">
          <div className={cn("relative", isCollapsed ? "h-8 w-8" : "h-10 w-40")}>
            <Image
              src="https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/ideatostartup%20logo-T5tDhi08w5P7UbKugr2K20yDZbMe4h.png"
              alt="IdeaToStartup Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>
      </div>

      {/* Rest of the sidebar code remains unchanged */}
      <div className="custom-scrollbar flex-1 overflow-auto py-4">
        <nav className="space-y-1 px-2">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
              pathname === "/dashboard" ? "text-primary" : "text-gray-300 hover:text-white",
            )}
          >
            <LayoutGrid className="h-5 w-5" />
            {!isCollapsed && <span className="text-primary">Dashboard</span>}
          </Link>

          {/* Knowledge Bank */}
          <div>
            <button
              onClick={() => toggleSection("knowledge-bank")}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:text-white"
            >
              <div className="flex items-center gap-3">
                <BookText className="h-5 w-5" />
                {!isCollapsed && <span>Knowledge Bank</span>}
              </div>
              {!isCollapsed &&
                (openSections["knowledge-bank"] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                ))}
            </button>
            {openSections["knowledge-bank"] && !isCollapsed && (
              <div className="ml-8 mt-1 space-y-1">
                <Link
                  href="/dashboard/knowledge/founders-journey"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/knowledge/founders-journey"
                      ? "text-white"
                      : "text-gray-400 hover:text-white",
                  )}
                >
                  Founder's Journey
                </Link>
                <Link
                  href="/dashboard/knowledge/domain"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/knowledge/domain" ? "text-white" : "text-gray-400 hover:text-white",
                  )}
                >
                  Domain Knowledge
                </Link>
                <Link
                  href="/dashboard/knowledge/feedback"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/knowledge/feedback" ? "text-white" : "text-gray-400 hover:text-white",
                  )}
                >
                  Feedback Insights
                </Link>
              </div>
            )}
          </div>

          {/* Idea to Product */}
          <div>
            <button
              onClick={() => toggleSection("idea-to-product")}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-primary hover:text-primary"
            >
              <div className="flex items-center gap-3">
                <Lightbulb className="h-5 w-5" />
                {!isCollapsed && <span>Idea to Product</span>}
              </div>
              {!isCollapsed &&
                (openSections["idea-to-product"] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                ))}
            </button>
            {openSections["idea-to-product"] && !isCollapsed && (
              <div className="ml-8 mt-1 space-y-1">
                <Link
                  href="/dashboard/idea/analyser"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/idea/analyser" ? "text-white" : "text-gray-400 hover:text-white",
                  )}
                >
                  Business Idea Analysis
                </Link>
                <Link
                  href="/dashboard/idea/consumer-market-insights"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/idea/consumer-market-insights"
                      ? "text-primary"
                      : "text-gray-400 hover:text-white",
                  )}
                >
                  Consumer and Market Insights
                </Link>
                <Link
                  href="/dashboard/idea/competitor-analysis"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/idea/competitor-analysis"
                      ? "text-white"
                      : "text-gray-400 hover:text-white",
                  )}
                >
                  Competitor Analysis
                </Link>
                <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-500">
                  <span>Value Proposition Generator</span>
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs">Soon</span>
                </div>
                <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-500">
                  <span>Business Model Generator</span>
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs">Soon</span>
                </div>
                <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-500">
                  <span>Product Roadmap Builder</span>
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs">Soon</span>
                </div>
                <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-500">
                  <span>MVP Dev Suite</span>
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs">Soon</span>
                </div>
              </div>
            )}
          </div>

          {/* Product to Market */}
          <div>
            <button
              onClick={() => toggleSection("product-to-market")}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-primary hover:text-primary"
            >
              <div className="flex items-center gap-3">
                <Rocket className="h-5 w-5" />
                {!isCollapsed && <span>Product to Market</span>}
              </div>
              {!isCollapsed &&
                (openSections["product-to-market"] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                ))}
            </button>
            {openSections["product-to-market"] && !isCollapsed && (
              <div className="ml-8 mt-1 space-y-1">
                <Link
                  href="/dashboard/market/go-to-market"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/market/go-to-market" ? "text-white" : "text-gray-400 hover:text-white",
                  )}
                >
                  Go-To-Market
                </Link>
                <Link
                  href="/dashboard/pitch"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/pitch" ? "text-white" : "text-gray-400 hover:text-white",
                  )}
                >
                  Pitch Deck
                </Link>
                <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-500">
                  <span>LLC Formation</span>
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs">Soon</span>
                </div>
                <Link
                  href="/dashboard/market/legal-requirements"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/market/legal-requirements"
                      ? "text-white"
                      : "text-gray-400 hover:text-white",
                  )}
                >
                  Startup Legal Requirements
                </Link>
                <Link
                  href="/dashboard/market/investor-database"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/market/investor-database"
                      ? "text-white"
                      : "text-gray-400 hover:text-white",
                  )}
                >
                  Investor Database
                </Link>
                <Link
                  href="/dashboard/market/fundraising"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/market/fundraising" ? "text-white" : "text-gray-400 hover:text-white",
                  )}
                >
                  Fundraising Strategy
                </Link>
              </div>
            )}
          </div>

          {/* Market to Scale */}
          <div>
            <button
              onClick={() => toggleSection("market-to-scale")}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-primary hover:text-primary"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5" />
                {!isCollapsed && <span>Market to Scale</span>}
              </div>
              {!isCollapsed &&
                (openSections["market-to-scale"] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                ))}
            </button>
            {openSections["market-to-scale"] && !isCollapsed && (
              <div className="ml-8 mt-1 space-y-1">
                <Link
                  href="/dashboard/scale/startup-credits"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/scale/startup-credits" ? "text-white" : "text-gray-400 hover:text-white",
                  )}
                >
                  Startup Credits Database
                </Link>
                <Link
                  href="/dashboard/scale/global-events"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/scale/global-events" ? "text-white" : "text-gray-400 hover:text-white",
                  )}
                >
                  Global Startup Events 2025
                </Link>
                <Link
                  href="/dashboard/scale/financial"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/scale/financial" ? "text-white" : "text-gray-400 hover:text-white",
                  )}
                >
                  Financial Engineering
                </Link>
                <Link
                  href="/dashboard/scale/recruiting"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/scale/recruiting" ? "text-white" : "text-gray-400 hover:text-white",
                  )}
                >
                  Recruiting Agent
                </Link>
                <Link
                  href="/dashboard/scale/landscape"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/scale/landscape" ? "text-white" : "text-gray-400 hover:text-white",
                  )}
                >
                  Landscape Scanner
                </Link>
                <Link
                  href="/dashboard/scale/business-plan"
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium",
                    pathname === "/dashboard/scale/business-plan" ? "text-white" : "text-gray-400 hover:text-white",
                  )}
                >
                  Full Business Plan
                </Link>
              </div>
            )}
          </div>

          {/* Settings */}
          <Link
            href="/dashboard/settings"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
              pathname === "/dashboard/settings" ? "text-white" : "text-gray-300 hover:text-white",
            )}
          >
            <Settings className="h-5 w-5" />
            {!isCollapsed && <span>Settings</span>}
          </Link>
        </nav>
      </div>
    </div>
  )
}

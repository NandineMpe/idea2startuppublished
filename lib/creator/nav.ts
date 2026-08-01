import type React from "react"
import {
  Compass,
  DollarSign,
  Fingerprint,
  FileVideo,
  Handshake,
  History,
  Lightbulb,
  Newspaper,
  Radio,
  Settings,
  Sunrise,
} from "lucide-react"

/**
 * The creator workspace's destinations, in one place.
 *
 * Shared by the desktop sidebar and the mobile bar rather than duplicated. Two
 * lists drift the moment a screen is added, and the symptom is a route that is
 * reachable on a laptop and invisible on a phone.
 */
export type CreatorNavItem = {
  title: string
  /** The shorter label a bottom bar has room for. */
  short?: string
  href: string
  icon: React.ElementType
  exact?: boolean
  /** Shown in the phone's bottom bar. Everything else lives behind More. */
  primary?: boolean
}

export const CREATOR_NAV: CreatorNavItem[] = [
  { title: "The Desk", short: "Desk", href: "/creator/dashboard", icon: Sunrise, exact: true, primary: true },
  { title: "Trajectory", href: "/creator/dashboard/trajectory", icon: Compass },
  { title: "The wire", short: "Wire", href: "/creator/dashboard/feed", icon: Radio, primary: true },
  { title: "Stories", href: "/creator/dashboard/stories", icon: Newspaper, primary: true },
  { title: "Open files", short: "Files", href: "/creator/dashboard/threads", icon: History },
  { title: "Opportunities", short: "Deals", href: "/creator/dashboard/opportunities", icon: Handshake },
  { title: "Next Five", short: "Next", href: "/creator/dashboard/next", icon: Lightbulb, primary: true },
  { title: "Worth", href: "/creator/dashboard/worth", icon: DollarSign },
  { title: "Canon", href: "/creator/dashboard/canon", icon: Fingerprint },
  { title: "Content", href: "/creator/dashboard/content", icon: FileVideo },
  { title: "Settings", href: "/creator/dashboard/settings", icon: Settings },
]

/** Whether a nav item is the one currently being viewed. */
export function isNavActive(item: CreatorNavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
}

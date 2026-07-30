import type { CareerOsIconName } from "@/components/careeros/icon"

export type CareerOsRoute = {
  path: string
  label: string
  icon: CareerOsIconName
  section: "career" | "careeros"
  crumb: string[]
  badge?: string
  exact?: boolean
}

export const CAREER_OS_ROUTES: CareerOsRoute[] = [
  {
    path: "/career/dashboard",
    label: "Dashboard",
    icon: "home",
    section: "career",
    crumb: ["Career", "Dashboard"],
    exact: true,
  },
  {
    path: "/careeros",
    label: "Workspace home",
    icon: "layers",
    section: "careeros",
    crumb: ["CareerOS", "Workspace"],
    exact: true,
  },
  {
    path: "/careeros/skills",
    label: "Skill portfolio",
    icon: "brain",
    section: "careeros",
    crumb: ["CareerOS", "Skills"],
  },
  {
    path: "/careeros/market",
    label: "Market intelligence",
    icon: "trending",
    section: "careeros",
    crumb: ["CareerOS", "Market"],
  },
  {
    path: "/careeros/feed",
    label: "AI Updates",
    icon: "news",
    section: "careeros",
    crumb: ["CareerOS", "Feed"],
    badge: "12",
  },
  {
    path: "/careeros/health-report",
    label: "Health Report",
    icon: "heart",
    section: "careeros",
    crumb: ["CareerOS", "Health Report"],
  },
]

export function matchCareerOsRoute(pathname: string): CareerOsRoute {
  const exact = CAREER_OS_ROUTES.find((r) => r.exact && pathname === r.path)
  if (exact) return exact
  const prefix = [...CAREER_OS_ROUTES]
    .filter((r) => !r.exact && (pathname === r.path || pathname.startsWith(r.path + "/")))
    .sort((a, b) => b.path.length - a.path.length)[0]
  return prefix ?? CAREER_OS_ROUTES[0]
}

export function isCareerOsNavActive(pathname: string, route: CareerOsRoute): boolean {
  if (route.exact) return pathname === route.path
  return pathname === route.path || pathname.startsWith(route.path + "/")
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Layers, MoreHorizontal, X } from "lucide-react"
import { CREATOR_NAV, isNavActive } from "@/lib/creator/nav"
import { cn } from "@/lib/utils"

/**
 * Navigation on a phone.
 *
 * A bottom bar rather than a shrunken sidebar. The desktop sidebar is 220px,
 * which is well over half of a 375px screen, and collapsing it to icons trades
 * one bad answer for another. Thumbs reach the bottom of a phone and not the
 * top left.
 *
 * Four destinations get a slot and the rest live behind More. That split is a
 * real editorial choice: the wire, stories and the queue are what this product
 * is used for daily, while the canon, worth and settings are read occasionally.
 */
export function CreatorMobileNav() {
  const pathname = usePathname() ?? ""
  const [open, setOpen] = useState(false)

  const primary = CREATOR_NAV.filter((i) => i.primary)
  const rest = CREATOR_NAV.filter((i) => !i.primary)

  // A route change with the sheet still open leaves it covering the page the
  // creator just asked for.
  useEffect(() => setOpen(false), [pathname])

  // The sheet scrolls itself; the page behind it should not.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const moreActive = rest.some((i) => isNavActive(i, pathname))

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {open && (
        <div
          role="dialog"
          aria-label="All screens"
          // pb accounts for the bar it sits above plus the home indicator.
          className="fixed inset-x-0 bottom-0 z-50 md:hidden rounded-t-2xl border-t border-border bg-card px-3 pt-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] max-h-[75dvh] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-[13px] font-semibold text-foreground">All screens</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-0.5">
            {rest.map((item) => {
              const active = isNavActive(item, pathname)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    // 48px rows: a nav list is the one place a mis-tap costs a
                    // whole page load.
                    "flex items-center gap-3 rounded-lg px-3 min-h-[48px] text-[14px] font-medium transition-colors",
                    active
                      ? "bg-violet-500/10 text-violet-700 dark:text-violet-400"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {item.title}
                </Link>
              )
            })}

            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg px-3 min-h-[48px] text-[14px] font-medium text-muted-foreground hover:bg-accent"
            >
              <Layers className="h-[18px] w-[18px] shrink-0" />
              All modes
            </Link>
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5">
          {primary.map((item) => {
            const active = isNavActive(item, pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[10px] font-medium transition-colors",
                  active ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-[19px] w-[19px]" />
                {item.short ?? item.title}
              </Link>
            )
          })}

          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[10px] font-medium transition-colors",
              open || moreActive ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="h-[19px] w-[19px]" />
            More
          </button>
        </div>
      </nav>
    </>
  )
}

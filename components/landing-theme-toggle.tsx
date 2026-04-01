"use client"

import { MoonStar, SunMedium } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function LandingThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = mounted ? resolvedTheme : "light"

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 p-1 text-slate-600 shadow-[0_8px_24px_rgba(148,163,184,0.12)] backdrop-blur transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:shadow-[0_18px_40px_rgba(2,8,14,0.24)]">
      <button
        type="button"
        aria-pressed={activeTheme === "light"}
        onClick={() => setTheme("light")}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors ${
          activeTheme === "light"
            ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
            : "hover:bg-slate-100 dark:hover:bg-white/10"
        }`}
      >
        <SunMedium className="h-4 w-4" />
        <span className="hidden sm:inline">Light</span>
      </button>
      <button
        type="button"
        aria-pressed={activeTheme === "dark"}
        onClick={() => setTheme("dark")}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors ${
          activeTheme === "dark"
            ? "bg-slate-950 text-white dark:bg-sky-100 dark:text-slate-950"
            : "hover:bg-slate-100 dark:hover:bg-white/10"
        }`}
      >
        <MoonStar className="h-4 w-4" />
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  )
}

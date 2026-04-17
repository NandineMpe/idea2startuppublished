"use client"

import { useState } from "react"
import { Eye, LogOut, Loader2 } from "lucide-react"

export function PreviewModeBanner({ label }: { label: string }) {
  const [exiting, setExiting] = useState(false)

  async function exitPreview() {
    setExiting(true)
    try {
      await fetch("/api/preview/exit", { method: "POST" })
    } catch {
      // ignore
    }
    window.location.href = "/login"
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-indigo-500/30 bg-indigo-500/10 px-4 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 text-indigo-300 shrink-0" />
        <p className="text-[13px] text-indigo-100 truncate">
          Read-only preview for <span className="font-semibold">{label}</span>. Everything is viewable, nothing can be changed.
        </p>
      </div>
      <button
        type="button"
        onClick={exitPreview}
        disabled={exiting}
        className="inline-flex items-center gap-1.5 rounded-md border border-indigo-400/40 bg-indigo-500/20 px-2.5 py-1 text-[12px] font-medium text-indigo-100 hover:bg-indigo-500/30 transition-colors disabled:opacity-60"
      >
        {exiting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        Exit preview
      </button>
    </div>
  )
}

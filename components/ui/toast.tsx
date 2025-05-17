"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ToastProps {
  title: string
  description?: string
  variant?: "default" | "destructive"
  onClose?: () => void
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ title, description, variant = "default", onClose, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "fixed bottom-4 right-4 z-50 flex w-full max-w-md items-center justify-between rounded-lg border p-4 shadow-lg",
          variant === "destructive" ? "border-red-500 bg-red-500/10" : "border-primary/20 bg-black/80",
        )}
        {...props}
      >
        <div className="flex-1">
          <h3 className={cn("text-sm font-medium", variant === "destructive" ? "text-red-400" : "text-white")}>
            {title}
          </h3>
          {description && (
            <p className={cn("mt-1 text-sm", variant === "destructive" ? "text-red-300/90" : "text-white/80")}>
              {description}
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              "ml-4 rounded-md p-1",
              variant === "destructive" ? "text-red-300 hover:text-red-200" : "text-white/60 hover:text-white",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  },
)
Toast.displayName = "Toast"

export { Toast }

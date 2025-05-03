"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

type ToastVariants = VariantProps<typeof toastVariants> & {
  default: string
  destructive: string
  success: string
}

interface ToastProps {
  title: string
  description?: string
  variant?: "default" | "destructive" | "success"
  onClose?: () => void
}

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive: "destructive group border-destructive bg-destructive text-destructive-foreground",
        success: "border-green-500 bg-green-500 bg-opacity-20 text-green-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ title, description, variant = "default", onClose, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "fixed bottom-4 right-4 z-50 flex w-full max-w-md items-center justify-between rounded-lg border p-4 shadow-lg",
          variant === "destructive" ? "border-red-500 bg-red-500/10" : "border-primary/20 bg-black/80",
          variant === "success" ? "border-green-500 bg-green-500/10" : "",
        )}
        {...props}
      >
        <div className="flex-1">
          <h3
            className={cn(
              "text-sm font-medium",
              variant === "destructive" ? "text-red-400" : "text-white",
              variant === "success" ? "text-green-500" : "",
            )}
          >
            {title}
          </h3>
          {description && (
            <p
              className={cn(
                "mt-1 text-sm",
                variant === "destructive" ? "text-red-300/90" : "text-white/80",
                variant === "success" ? "text-green-300/90" : "",
              )}
            >
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
              variant === "success" ? "text-green-300 hover:text-green-200" : "",
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

export { Toast, toastVariants }

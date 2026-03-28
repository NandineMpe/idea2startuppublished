"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback } from "react"
import {
  ToastProvider as RadixToastProvider,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastViewport,
} from "./toast"

type ToastType = {
  id: string
  title: string
  description?: string
  variant?: "default" | "destructive"
}

interface ToastContextType {
  toasts: ToastType[]
  toast: (props: { title: string; description?: string; variant?: "default" | "destructive" }) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastType[]>([])

  const toast = useCallback(
    ({
      title,
      description,
      variant = "default",
    }: { title: string; description?: string; variant?: "default" | "destructive" }) => {
      const id = Math.random().toString(36).substring(2, 9)
      setToasts((prev) => [...prev, { id, title, description, variant }])
    },
    [],
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <RadixToastProvider>
      <ToastContext.Provider value={{ toasts, toast, dismiss }}>
        {children}
        {toasts.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            duration={5000}
            onOpenChange={(open) => {
              if (!open) dismiss(t.id)
            }}
          >
            <ToastTitle>{t.title}</ToastTitle>
            {t.description ? <ToastDescription>{t.description}</ToastDescription> : null}
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastContext.Provider>
    </RadixToastProvider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

export const toast = (props: { title: string; description?: string; variant?: "default" | "destructive" }) => {
  console.log("Toast:", props.title, props.description)
}

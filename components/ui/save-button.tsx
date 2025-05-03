"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Check, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface SaveButtonProps {
  onSave: () => Promise<boolean>
  className?: string
  loadingText?: string
  successText?: string
  errorText?: string
  children: React.ReactNode
}

export function SaveButton({
  onSave,
  className = "bg-primary hover:bg-primary/90 text-black font-medium",
  loadingText = "Saving...",
  successText = "Changes saved successfully",
  errorText = "Failed to save changes",
  children,
}: SaveButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const { toast } = useToast()

  const handleSave = async () => {
    setIsLoading(true)
    setStatus("idle")

    try {
      const success = await onSave()

      if (success) {
        setStatus("success")
        toast({
          title: "Success",
          description: successText,
          variant: "success",
        })
      } else {
        setStatus("error")
        toast({
          title: "Error",
          description: errorText,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Save error:", error)
      setStatus("error")
      toast({
        title: "Error",
        description: errorText,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)

      // Reset success status after 2 seconds
      if (status === "success") {
        setTimeout(() => {
          setStatus("idle")
        }, 2000)
      }
    }
  }

  return (
    <Button className={className} onClick={handleSave} disabled={isLoading}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : status === "success" ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          {children}
        </>
      ) : status === "error" ? (
        <>
          <AlertCircle className="mr-2 h-4 w-4" />
          {children}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

// Simplified version for the example
import { toast as sonnerToast } from "sonner"

export function toast({ title, description, variant }: { title: string; description: string; variant?: string }) {
  if (variant === "destructive") {
    return sonnerToast.error(title, {
      description,
    })
  }

  return sonnerToast(title, {
    description,
  })
}

export const useToast = () => {
  return {
    toast,
  }
}

"use client"

import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { ComponentProps } from "react"

export function SubmitButton({ children, pendingText = "Submitting...", ...props }: ComponentProps<typeof Button> & { pendingText?: string }) {
    const { pending } = useFormStatus()

    return (
        <Button
            type="submit"
            disabled={pending}
            aria-disabled={pending}
            {...props}
        >
            {pending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {pendingText}
                </>
            ) : (
                children
            )}
        </Button>
    )
}

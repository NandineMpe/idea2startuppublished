"use client"

import { SignIn } from "@clerk/nextjs"
import { useSearchParams } from "next/navigation"

export default function Page() {
  // Get the redirect URL from the query parameters
  const searchParams = useSearchParams()
  const redirectUrl = searchParams?.get("redirect_url") || "/dashboard"

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-black/80 backdrop-blur-md border border-primary/20",
            headerTitle: "text-white",
            headerSubtitle: "text-white/70",
            formButtonPrimary: "bg-primary hover:bg-primary/80 text-black",
            formFieldLabel: "text-white/80",
            formFieldInput: "bg-black/50 border-primary/30 text-white",
            footerActionLink: "text-primary hover:text-primary/80",
            identityPreviewText: "text-white",
            identityPreviewEditButton: "text-primary",
            formFieldAction: "text-primary",
            formFieldInputShowPasswordButton: "text-primary",
            otpCodeFieldInput: "bg-black/50 border-primary/30 text-white",
          },
        }}
        redirectUrl={redirectUrl}
      />
    </div>
  )
}

"use client"

import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md">
        <SignIn
          appearance={{
            baseTheme: undefined,
            variables: {
              colorPrimary: "#3b82f6",
              colorBackground: "#000000",
              colorInputBackground: "rgba(255, 255, 255, 0.1)",
              colorInputText: "#ffffff",
              colorText: "#ffffff",
              colorTextSecondary: "rgba(255, 255, 255, 0.6)",
              borderRadius: "8px",
            },
            elements: {
              formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
              card: "bg-black/80 backdrop-blur-md border border-blue-500/20",
              headerTitle: "text-white",
              headerSubtitle: "text-white/60",
              socialButtonsBlockButton: "border-blue-500/20 text-white hover:bg-blue-500/10",
              formFieldLabel: "text-white",
              formFieldInput: "bg-black/40 border-blue-500/20 text-white",
              footerActionLink: "text-blue-400 hover:text-blue-300",
            },
          }}
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  )
}

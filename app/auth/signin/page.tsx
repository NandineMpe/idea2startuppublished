"use client"

import { SignIn } from "@clerk/nextjs"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Back to Home */}
        <Link href="/" className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>

        <SignIn
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-gray-800/50 backdrop-blur-sm border-gray-700",
              headerTitle: "text-2xl font-bold text-center text-white",
              headerSubtitle: "text-center text-gray-400",
              socialButtonsBlockButton: "border-gray-600 bg-gray-700/50 text-white hover:bg-gray-600",
              dividerLine: "bg-gray-600",
              dividerText: "bg-gray-800 text-gray-400",
              formFieldLabel: "text-white",
              formFieldInput: "border-gray-600 bg-gray-700/50 text-white placeholder:text-gray-400",
              formButtonPrimary: "bg-blue-600 hover:bg-blue-700",
              footerActionLink: "text-blue-400 hover:text-blue-300 font-medium",
              footerActionText: "text-gray-400",
            },
          }}
          redirectUrl="/dashboard"
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  )
}

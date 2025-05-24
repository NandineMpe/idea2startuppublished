import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { Announcement } from "@/components/ui/announcement"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "IdeaToStartup - Transform Ideas into Successful Startups",
  description:
    "AI-powered platform to analyze business ideas, generate pitch decks, and guide your entrepreneurial journey from concept to launch.",
  keywords: "startup, business ideas, pitch deck, entrepreneurship, AI analysis",
  authors: [{ name: "IdeaToStartup Team" }],
  openGraph: {
    title: "IdeaToStartup - Transform Ideas into Successful Startups",
    description: "AI-powered platform to analyze business ideas and guide your entrepreneurial journey",
    type: "website",
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#3b82f6",
          colorBackground: "#1f2937",
          colorInputBackground: "#374151",
          colorInputText: "#f3f4f6",
        },
        elements: {
          formButtonPrimary: "bg-blue-600 hover:bg-blue-700",
          card: "bg-gray-800/50 backdrop-blur-sm border-gray-700",
        },
      }}
    >
      <html lang="en" className="dark">
        <body className={inter.className}>
          <Announcement />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}

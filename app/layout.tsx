import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/providers/session-provider"

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
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}

import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastProvider } from "@/components/ui/toast-context"
import { Toaster } from "@/components/ui/toaster"
import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "Juno AI",
  description: "A calm operating system for company context, briefs, and founder workflows.",
  generator: "Next.js",
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <ToastProvider>
            <Suspense>{children}</Suspense>
            <Toaster />
          </ToastProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

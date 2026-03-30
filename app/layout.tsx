import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastProvider } from "@/components/ui/toast-context"
import { Toaster } from "@/components/ui/toaster"
import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "IdeaToStartup - Dashboard",
  description: "Transform your ideas into successful startups",
  generator: "Next.js",
  icons: {
    icon: "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Favicons/favicon-32x32-Snr2foWGkL5oziUnbiblGmgamGwuLp.png",
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
        <link
          rel="icon"
          href="https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Favicons/favicon-32x32-Snr2foWGkL5oziUnbiblGmgamGwuLp.png"
          type="image/png"
          sizes="32x32"
        />
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

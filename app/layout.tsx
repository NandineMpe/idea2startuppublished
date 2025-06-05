import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastProvider } from "@/components/ui/toast-context"
import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"

const inter = Inter({ subsets: ["latin"] })

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
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className="dark">
        <head>
          <link
            rel="icon"
            href="https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Favicons/favicon-32x32-Snr2foWGkL5oziUnbiblGmgamGwuLp.png"
            type="image/png"
            sizes="32x32"
          />
        </head>
        <body className={inter.className}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <ToastProvider>
              <Suspense>{children}</Suspense>
            </ToastProvider>
          </ThemeProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}

"use client"

import { UserProfile } from "@clerk/nextjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProfilePage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="bg-black/50 border border-primary/20">
        <CardHeader>
          <CardTitle className="text-white">Your Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <UserProfile
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "bg-transparent border-0 shadow-none",
                navbar: "bg-black/50 border border-primary/20 rounded-lg mb-4",
                navbarButton: "text-white hover:bg-primary/10",
                navbarButtonActive: "bg-primary/20 text-white",
                headerTitle: "text-white",
                headerSubtitle: "text-white/70",
                formButtonPrimary: "bg-primary hover:bg-primary/80 text-white",
                formButtonReset: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
                formFieldLabel: "text-white",
                formFieldInput: "bg-black/50 border-primary/30 text-white",
                userPreviewMainIdentifier: "text-white",
                userPreviewSecondaryIdentifier: "text-white/70",
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

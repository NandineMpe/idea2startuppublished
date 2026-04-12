import { Suspense } from "react"
import { ClaimAccountClient } from "./claim-account-client"

export default function ClaimAccountPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <ClaimAccountClient params={params} />
    </Suspense>
  )
}

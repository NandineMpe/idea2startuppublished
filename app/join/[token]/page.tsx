import { Suspense } from "react"
import { JoinInviteClient } from "./join-invite-client"

export default function JoinInvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <JoinInviteClient params={params} />
    </Suspense>
  )
}

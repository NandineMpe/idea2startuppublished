"use client"

import { useRouter } from "next/navigation"

export function FeedItemActions({ itemId }: { itemId: string }) {
  const router = useRouter()
  async function run(action: "save" | "dismiss") {
    const res = await fetch(`/api/careeros/feed/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      credentials: "include",
    })
    if (res.ok) router.refresh()
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <button className="text-muted-foreground hover:underline" onClick={() => void run("save")} type="button">
        Save
      </button>
      <button className="text-muted-foreground hover:underline" onClick={() => void run("dismiss")} type="button">
        Dismiss
      </button>
    </div>
  )
}

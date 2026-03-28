"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

type Props = {
  onFinish: () => void
}

export function AgentActivation({ onFinish }: Props) {
  return (
    <div className="mx-auto max-w-lg px-5 pt-12">
      <h2 className="text-center text-xl font-semibold tracking-tight">Your executive team is ready</h2>
      <p className="mt-2 text-center text-sm text-muted-foreground leading-relaxed">
        Daily briefs, leads, and agent outputs show up in your{" "}
        <Link href="/dashboard" className="text-primary font-medium underline-offset-4 hover:underline">
          Intelligence Feed
        </Link>{" "}
        — no extra apps to connect.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 text-card-foreground text-sm text-muted-foreground leading-relaxed">
        <p className="text-foreground font-medium mb-2">What to do next</p>
        <ul className="list-disc list-inside space-y-1.5">
          <li>Open the feed anytime for scored news, research, and competitor context.</li>
          <li>Use <span className="text-foreground/90">Context</span> and <span className="text-foreground/90">Company</span> so agents stay aligned with your strategy.</li>
        </ul>
      </div>

      <div className="mt-8 flex justify-center">
        <Button type="button" size="lg" onClick={onFinish}>
          Go to dashboard
        </Button>
      </div>
    </div>
  )
}

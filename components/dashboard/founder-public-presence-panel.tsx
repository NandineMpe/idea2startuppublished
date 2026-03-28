"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { UpcomingTopicsPlanner } from "@/components/dashboard/upcoming-topics-planner"
import { useToast } from "@/hooks/use-toast"
import type { FounderBrandState, TiktokWorkDigestConfig } from "@/lib/founder-brand"

type Props = {
  hint: string
  placeholder: string
  data: FounderBrandState
  setData: React.Dispatch<React.SetStateAction<FounderBrandState>>
}

export function FounderPublicPresencePanel({ hint, placeholder, data, setData }: Props) {
  const { toast } = useToast()
  const [running, setRunning] = useState(false)
  const [focusExtra, setFocusExtra] = useState("")

  function patchTiktok(patch: Partial<TiktokWorkDigestConfig>) {
    setData((prev) => ({
      ...prev,
      tiktokWorkDigest: { ...prev.tiktokWorkDigest, ...patch },
    }))
  }

  async function runDigestNow() {
    setRunning(true)
    try {
      const res = await fetch("/api/founder/tiktok-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: focusExtra }),
      })
      const json = (await res.json()) as { digest?: string; error?: string; generatedAt?: string }
      if (!res.ok) {
        throw new Error(json.error || "Digest failed")
      }
      patchTiktok({
        digestBody: json.digest ?? "",
        lastDigestAt: json.generatedAt ?? new Date().toISOString(),
      })
      toast({ title: "Digest ready", description: "Snapshot for AI + AI at work — edit and turn into shorts." })
    } catch (e) {
      toast({
        title: "Digest failed",
        description: e instanceof Error ? e.message : "Try again shortly.",
        variant: "destructive",
      })
    } finally {
      setRunning(false)
    }
  }

  const td = data.tiktokWorkDigest

  return (
    <div className="space-y-6">
      <p className="text-[13px] leading-relaxed text-muted-foreground">{hint}</p>

      <div className="rounded-xl border border-border bg-gradient-to-br from-fuchsia-500/[0.06] via-card to-cyan-500/[0.06] p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              TikTok automation · AI work & trends
            </p>
            <h2 className="mt-1 text-[15px] font-semibold text-foreground">Digest for short-form</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Juno runs a <span className="font-medium text-foreground">snapshot synthesis</span> of what matters in
              general AI and <span className="font-medium text-foreground">AI in the world of work</span> — releases,
              discourse, and hooks you can react to. This is intentionally{" "}
              <span className="font-medium text-foreground">not</span> audit or compliance intelligence (unlike other
              Juno scans). Live TikTok scraping can plug in later; today you get a briefing you can film from.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 border-t border-border/80 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2">
            <Switch
              id="tiktok-auto"
              checked={td.automationEnabled}
              onCheckedChange={(c) => patchTiktok({ automationEnabled: c })}
            />
            <Label htmlFor="tiktok-auto" className="cursor-pointer text-[13px] font-normal">
              Plan scheduled digests (UI)
            </Label>
          </div>
          <div className="flex min-w-[180px] flex-1 items-center gap-2 sm:max-w-xs">
            <span className="text-[12px] text-muted-foreground shrink-0">Cadence</span>
            <Select
              value={td.digestFrequency}
              onValueChange={(v) =>
                patchTiktok({ digestFrequency: v as TiktokWorkDigestConfig["digestFrequency"] })
              }
            >
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Manual only</SelectItem>
                <SelectItem value="daily">Daily (coming)</SelectItem>
                <SelectItem value="weekly">Weekly (coming)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Scheduling runs server-side next — use <span className="font-medium text-foreground">Run digest now</span>{" "}
          today.
        </p>

        <div className="mt-4 space-y-2">
          <Label htmlFor="tiktok-focus" className="text-[12px] text-muted-foreground">
            Optional angle for this run (e.g. “SMB”, “Europe”, “developers”)
          </Label>
          <input
            id="tiktok-focus"
            value={focusExtra}
            onChange={(e) => setFocusExtra(e.target.value)}
            className="flex h-9 w-full max-w-xl rounded-md border border-input bg-background px-3 text-[13px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Leave blank for a broad AI + work snapshot"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" className="gap-1.5" disabled={running} onClick={() => void runDigestNow()}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Run digest now
          </Button>
          {td.lastDigestAt ? (
            <span className="text-[11px] text-muted-foreground">
              Last run: {new Date(td.lastDigestAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="tiktok-digest-body" className="text-[13px] font-medium">
            Latest digest
          </Label>
          <Textarea
            id="tiktok-digest-body"
            value={td.digestBody}
            onChange={(e) => patchTiktok({ digestBody: e.target.value })}
            placeholder="Run digest now to fill this — then edit, cut into scripts, or stash ideas."
            rows={12}
            className="min-h-[220px] resize-y font-mono text-[12px] leading-relaxed"
          />
        </div>
      </div>

      <UpcomingTopicsPlanner data={data} setData={setData} />

      <div className="space-y-2">
        <Label htmlFor="fb-publicPresence" className="text-[13px] font-medium">
          Other channels &amp; cadence
        </Label>
        <p className="text-[12px] text-muted-foreground">
          LinkedIn, talks, newsletter, podcast — where else you show up beyond short-form.
        </p>
        <Textarea
          id="fb-publicPresence"
          value={data.publicPresence}
          onChange={(e) => setData((prev) => ({ ...prev, publicPresence: e.target.value }))}
          placeholder={placeholder}
          rows={10}
          className="min-h-[200px] resize-y text-[13px] leading-relaxed"
        />
      </div>
    </div>
  )
}

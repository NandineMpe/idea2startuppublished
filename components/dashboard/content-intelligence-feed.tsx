"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

type Story = {
  id: string
  title: string
  url: string
  source: string
  pillar: string
  urgency: string
  content_score: number
  hook: string
  why_it_matters: string
  connected_topics?: string[]
  status: "new" | "queued" | "filmed" | "skipped"
}

type Briefing = {
  id: string
  generated_at: string
  summary: string
  top_hook: string
}

function isCollabStory(story: Story): boolean {
  const topics = (story.connected_topics ?? []).map((t) => t.toLowerCase())
  if (topics.includes("collab_opportunity")) return true
  const text = `${story.title} ${story.hook} ${story.why_it_matters}`.toLowerCase()
  return /(sponsor|sponsorship|brand deal|partnership|collab|collaboration|creator program|ugc|affiliate|ambassador|looking for)/.test(
    text,
  )
}

export function ContentIntelligenceFeed() {
  const { toast } = useToast()
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [pillar, setPillar] = useState("all")
  const [status, setStatus] = useState("all")
  const [minScore, setMinScore] = useState("4")
  const [angle, setAngle] = useState("")

  async function load() {
    setLoading(true)
    try {
      const [b, s] = await Promise.all([
        fetch("/api/content-feed/briefing").then((r) => r.json()),
        fetch(`/api/content-feed/stories?pillar=${pillar}&status=${status}&minScore=${minScore}`).then((r) => r.json()),
      ])
      setBriefing((b.briefing as Briefing | null) ?? null)
      setStories((s.stories as Story[]) ?? [])
    } catch {
      toast({ title: "Feed load failed", description: "Try again shortly.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pillar, status, minScore])

  const sections = useMemo(
    () => ({
      collab: stories.filter((s) => isCollabStory(s)).sort((a, b) => b.content_score - a.content_score),
      breaking: stories.filter((s) => s.urgency === "breaking"),
      ready: stories.filter((s) => s.content_score >= 7 && s.urgency !== "breaking"),
      watch: stories.filter((s) => s.content_score >= 4 && s.content_score < 7),
      deep: stories.filter((s) => s.pillar === "deep_dive"),
    }),
    [stories],
  )

  async function runDigestNow() {
    setRunning(true)
    try {
      const res = await fetch("/api/content-feed/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ angle }),
      })
      if (!res.ok) throw new Error("Failed to trigger digest")
      toast({ title: "Digest requested", description: "Inngest is running. Pulling fresh feed in a few seconds." })
      setTimeout(() => {
        void load()
      }, 5000)
    } catch {
      toast({ title: "Could not trigger digest", description: "Check Inngest connection.", variant: "destructive" })
    } finally {
      setRunning(false)
    }
  }

  async function updateStatus(id: string, next: Story["status"]) {
    const res = await fetch("/api/content-feed/stories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    })
    if (!res.ok) {
      toast({ title: "Status update failed", variant: "destructive" })
      return
    }
    setStories((prev) => prev.map((s) => (s.id === id ? { ...s, status: next } : s)))
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">AI Content Intelligence Feed</p>
          <p className="text-[13px] text-muted-foreground">
            {briefing?.generated_at ? `Last updated: ${new Date(briefing.generated_at).toLocaleString()}` : "No briefing yet"}
            {" "}
            Signals come from RSS (major tech and AI outlets).
          </p>
        </div>
        <Button size="sm" onClick={() => void runDigestNow()} disabled={running}>
          {running ? "Triggering..." : "Run digest now"}
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Select value={pillar} onValueChange={setPillar}>
          <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Pillar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Pillar: all</SelectItem>
            <SelectItem value="breaking">Breaking</SelectItem>
            <SelectItem value="workplace">Workplace</SelectItem>
            <SelectItem value="hacks">Hacks</SelectItem>
            <SelectItem value="deep_dive">Deep dive</SelectItem>
            <SelectItem value="safety_trust">Safety/trust</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status: all</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="filmed">Filmed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
        <Select value={minScore} onValueChange={setMinScore}>
          <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Min score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="4">Min score: 4</SelectItem>
            <SelectItem value="7">Min score: 7</SelectItem>
            <SelectItem value="8">Min score: 8</SelectItem>
          </SelectContent>
        </Select>
        <input
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-[12px]"
          placeholder="Optional angle (manual run)"
        />
      </div>

      {briefing?.summary ? (
        <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-[12px] font-medium text-foreground">Summary</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{briefing.summary}</p>
          <p className="mt-2 text-[12px] text-foreground">Top hook: {briefing.top_hook}</p>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {[
          { label: "Collab opportunities", items: sections.collab },
          { label: "Breaking", items: sections.breaking },
          { label: "Ready to film", items: sections.ready },
          { label: "Watch list", items: sections.watch },
          { label: "Deep dive seeds", items: sections.deep },
        ].map((section) => (
          <div key={section.label}>
            <Label className="text-[12px] font-semibold">{section.label} ({section.items.length})</Label>
            <div className="mt-2 space-y-2">
              {section.items.slice(0, 8).map((story) => (
                <div key={story.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{story.title}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {story.source}
                        {isCollabStory(story) ? <span className="ml-2 text-emerald-600 dark:text-emerald-400">Collab</span> : null}
                      </p>
                    </div>
                    <Badge variant="secondary">{story.content_score}/10</Badge>
                  </div>
                  <p className="mt-1 text-[12px] text-foreground">{story.hook}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(["new", "queued", "filmed", "skipped"] as const).map((s) => (
                      <Button
                        key={s}
                        type="button"
                        size="sm"
                        variant={story.status === s ? "default" : "outline"}
                        className="h-7 text-[11px]"
                        onClick={() => void updateStatus(story.id, s)}
                      >
                        {s}
                      </Button>
                    ))}
                    <a href={story.url} target="_blank" rel="noreferrer" className="ml-auto text-[11px] text-primary underline">
                      Source
                    </a>
                  </div>
                </div>
              ))}
              {!loading && section.items.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">No stories in this section yet.</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

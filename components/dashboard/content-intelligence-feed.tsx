"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
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

type ContentIntelligenceFeedProps = {
  talkingPoints?: string
  talkingPointsGeneratedAt?: string | null
  onTalkingPointsChange?: (value: string) => void
  onTalkingPointsGeneratedAtChange?: (value: string | null) => void
}

function storyMatchesQuery(story: Story, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const hay = `${story.title} ${story.hook} ${story.source} ${story.why_it_matters ?? ""}`.toLowerCase()
  return hay.includes(needle)
}

function isCollabStory(story: Story): boolean {
  const topics = (story.connected_topics ?? []).map((t) => t.toLowerCase())
  if (topics.includes("collab_opportunity")) return true
  const text = `${story.title} ${story.hook} ${story.why_it_matters}`.toLowerCase()
  return /(sponsor|sponsorship|brand deal|partnership|collab|collaboration|creator program|ugc|affiliate|ambassador|looking for)/.test(
    text,
  )
}

export function ContentIntelligenceFeed({
  talkingPoints,
  talkingPointsGeneratedAt,
  onTalkingPointsChange,
  onTalkingPointsGeneratedAtChange,
}: ContentIntelligenceFeedProps) {
  const { toast } = useToast()
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runningTalkingPoints, setRunningTalkingPoints] = useState(false)
  const [pillar, setPillar] = useState("all")
  const [status, setStatus] = useState("all")
  const [minScore, setMinScore] = useState("4")
  const [angle, setAngle] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [localTalkingPoints, setLocalTalkingPoints] = useState("")
  const [localTalkingPointsGeneratedAt, setLocalTalkingPointsGeneratedAt] = useState<string | null>(null)

  const resolvedTalkingPoints = talkingPoints ?? localTalkingPoints
  const resolvedTalkingPointsGeneratedAt = talkingPointsGeneratedAt ?? localTalkingPointsGeneratedAt

  function setTalkingPointsValue(value: string) {
    if (onTalkingPointsChange) {
      onTalkingPointsChange(value)
      return
    }
    setLocalTalkingPoints(value)
  }

  function setTalkingPointsGeneratedAtValue(value: string | null) {
    if (onTalkingPointsGeneratedAtChange) {
      onTalkingPointsGeneratedAtChange(value)
      return
    }
    setLocalTalkingPointsGeneratedAt(value)
  }

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

  const filteredStories = useMemo(
    () => stories.filter((s) => storyMatchesQuery(s, searchQuery)),
    [stories, searchQuery],
  )

  const sections = useMemo(
    () => ({
      collab: filteredStories.filter((s) => isCollabStory(s)).sort((a, b) => b.content_score - a.content_score),
      breaking: filteredStories.filter((s) => s.urgency === "breaking"),
      ready: filteredStories.filter((s) => s.content_score >= 7 && s.urgency !== "breaking"),
      watch: filteredStories.filter((s) => s.content_score >= 4 && s.content_score < 7),
      deep: filteredStories.filter((s) => s.pillar === "deep_dive"),
    }),
    [filteredStories],
  )

  async function runDigestNow() {
    setRunning(true)
    const beforeTs = briefing?.generated_at ?? null
    try {
      const res = await fetch("/api/content-feed/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ angle }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string; eventIds?: string[] }
      if (!res.ok) {
        throw new Error(json.error || "Failed to trigger digest")
      }
      toast({ title: "Digest requested", description: "Pulling fresh AI headlines. This can take up to a minute." })

      const deadline = Date.now() + 90_000
      const poll = async () => {
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 4000))
          try {
            const bRes = await fetch("/api/content-feed/briefing")
            const bJson = (await bRes.json()) as { briefing: Briefing | null }
            const nextTs = bJson.briefing?.generated_at ?? null
            if (nextTs && nextTs !== beforeTs) {
              await load()
              toast({ title: "Digest updated", description: "Stories match the latest run." })
              return
            }
          } catch {
            /* keep polling */
          }
        }
        await load()
        toast({
          title: "Still waiting?",
          description: "If the timestamp did not change, check Inngest and INNGEST_EVENT_KEY on the server.",
        })
      }
      void poll()
    } catch (e) {
      toast({
        title: "Could not trigger digest",
        description: e instanceof Error ? e.message : "Check Inngest connection.",
        variant: "destructive",
      })
    } finally {
      setRunning(false)
    }
  }

  async function generateTalkingPoints() {
    setRunningTalkingPoints(true)
    try {
      const res = await fetch("/api/founder/tiktok-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: angle }),
      })
      const json = (await res.json()) as { digest?: string; error?: string; generatedAt?: string }
      if (!res.ok) throw new Error(json.error || "Failed to generate talking points")

      const digest = json.digest ?? ""
      const generatedAt = json.generatedAt ?? new Date().toISOString()
      setTalkingPointsValue(digest)
      setTalkingPointsGeneratedAtValue(generatedAt)

      toast({
        title: "Talking points ready",
        description: "Generated from AI + work trends. Edit before filming.",
      })
    } catch (error) {
      toast({
        title: "Could not generate talking points",
        description: error instanceof Error ? error.message : "Try again shortly.",
        variant: "destructive",
      })
    } finally {
      setRunningTalkingPoints(false)
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
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void runDigestNow()} disabled={running}>
            {running ? "Triggering..." : "Run digest now"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void generateTalkingPoints()} disabled={runningTalkingPoints}>
            {runningTalkingPoints ? "Generating..." : "Generate talking points"}
          </Button>
        </div>
      </div>

      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Label htmlFor="content-feed-search" className="sr-only">
          Search stories
        </Label>
        <input
          id="content-feed-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-[13px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Search stories by title, hook, or source…"
          autoComplete="off"
        />
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

      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="content-feed-talking-points" className="text-[12px] font-semibold">
            AI + work talking points
          </Label>
          {resolvedTalkingPointsGeneratedAt ? (
            <span className="text-[11px] text-muted-foreground">
              Last generated: {new Date(resolvedTalkingPointsGeneratedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
        <Textarea
          id="content-feed-talking-points"
          value={resolvedTalkingPoints}
          onChange={(e) => setTalkingPointsValue(e.target.value)}
          placeholder="Generate talking points to get a short-form snapshot you can react to this week."
          rows={8}
          className="min-h-[170px] resize-y font-mono text-[12px] leading-relaxed"
        />
      </div>

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

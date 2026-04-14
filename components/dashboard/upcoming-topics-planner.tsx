"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { newUpcomingTopicId, type FounderBrandState, type UpcomingConversationTopic } from "@/lib/founder-brand"

type Props = {
  data: FounderBrandState
  setData: React.Dispatch<React.SetStateAction<FounderBrandState>>
}

function sortTopics(list: UpcomingConversationTopic[]): UpcomingConversationTopic[] {
  return [...list].sort((a, b) => {
    const da = a.scheduledDate.trim() || "9999-12-31"
    const db = b.scheduledDate.trim() || "9999-12-31"
    if (da !== db) return da.localeCompare(db)
    const ta = a.scheduledTime.trim() || "99:99"
    const tb = b.scheduledTime.trim() || "99:99"
    return ta.localeCompare(tb)
  })
}

export function UpcomingTopicsPlanner({ data, setData }: Props) {
  const topics = sortTopics(data.upcomingTopics ?? [])

  function updateTopic(id: string, patch: Partial<UpcomingConversationTopic>) {
    setData((prev) => ({
      ...prev,
      upcomingTopics: (prev.upcomingTopics ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }

  function removeTopic(id: string) {
    setData((prev) => ({
      ...prev,
      upcomingTopics: (prev.upcomingTopics ?? []).filter((t) => t.id !== id),
    }))
  }

  function addTopic() {
    const row: UpcomingConversationTopic = {
      id: newUpcomingTopicId(),
      title: "",
      notes: "",
      links: "",
      mediaNotes: "",
      scheduledDate: "",
      scheduledTime: "",
    }
    setData((prev) => ({
      ...prev,
      upcomingTopics: [row, ...(prev.upcomingTopics ?? [])],
    }))
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your schedule
          </p>
          <h2 className="mt-1 text-[15px] font-semibold text-foreground">Upcoming topics &amp; conversations</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Plan what you want to talk about next (live, podcast, TikTok, or customer calls). Add links and media notes
            so nothing is scattered across tabs the day you record.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={addTopic}>
          <Plus className="h-3.5 w-3.5" />
          Add topic
        </Button>
      </div>

      {topics.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-[13px] text-muted-foreground">
          No topics yet. Use <span className="font-medium text-foreground">Add topic</span> to schedule your next
          conversation.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {topics.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-border bg-background/80 p-4 shadow-sm dark:bg-background/40"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`topic-title-${t.id}`} className="text-[12px]">
                      Topic / title
                    </Label>
                    <Input
                      id={`topic-title-${t.id}`}
                      value={t.title}
                      onChange={(e) => updateTopic(t.id, { title: e.target.value })}
                      placeholder="e.g. Why we chose agents over static dashboards"
                      className="text-[13px]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`topic-date-${t.id}`} className="text-[12px] text-muted-foreground">
                        Date
                      </Label>
                      <Input
                        id={`topic-date-${t.id}`}
                        type="date"
                        value={t.scheduledDate}
                        onChange={(e) => updateTopic(t.id, { scheduledDate: e.target.value })}
                        className="h-9 w-[160px] text-[13px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`topic-time-${t.id}`} className="text-[12px] text-muted-foreground">
                        Time (optional)
                      </Label>
                      <Input
                        id={`topic-time-${t.id}`}
                        type="time"
                        value={t.scheduledTime}
                        onChange={(e) => updateTopic(t.id, { scheduledTime: e.target.value })}
                        className="h-9 w-[130px] text-[13px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`topic-notes-${t.id}`} className="text-[12px] text-muted-foreground">
                      Notes &amp; talking points
                    </Label>
                    <Textarea
                      id={`topic-notes-${t.id}`}
                      value={t.notes}
                      onChange={(e) => updateTopic(t.id, { notes: e.target.value })}
                      placeholder="Angle, audience, one CTA…"
                      rows={3}
                      className="resize-y text-[13px] leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`topic-links-${t.id}`} className="text-[12px] text-muted-foreground">
                      Supporting links
                    </Label>
                    <Textarea
                      id={`topic-links-${t.id}`}
                      value={t.links}
                      onChange={(e) => updateTopic(t.id, { links: e.target.value })}
                      placeholder="One URL per line: articles, papers, product pages, tweets…"
                      rows={3}
                      className="resize-y font-mono text-[12px] leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`topic-media-${t.id}`} className="text-[12px] text-muted-foreground">
                      Supporting media
                    </Label>
                    <Textarea
                      id={`topic-media-${t.id}`}
                      value={t.mediaNotes}
                      onChange={(e) => updateTopic(t.id, { mediaNotes: e.target.value })}
                      placeholder="Loom / Drive links, B-roll notes, screenshots, use clip at 0:45…"
                      rows={2}
                      className="resize-y text-[13px] leading-relaxed"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeTopic(t.id)}
                  aria-label="Remove topic"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

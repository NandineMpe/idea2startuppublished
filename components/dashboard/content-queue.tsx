"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Loader2,
  Check,
  X,
  Linkedin,
  FileCode,
  Users,
  MessageSquare,
  Megaphone,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

type ContentRow = {
  id: string
  type: string
  content: {
    platform?: string
    contentType?: string
    body?: string | Record<string, unknown>
    status?: string
  }
  created_at: string
}

const CONTENT_TYPE_META: Record<string, { label: string; icon: typeof Megaphone; color: string }> = {
  post: { label: "LinkedIn post", icon: Linkedin, color: "text-sky-600 bg-sky-500/10" },
  outreach: { label: "Outreach", icon: Users, color: "text-emerald-600 bg-emerald-500/10" },
  comment: { label: "Comment", icon: MessageSquare, color: "text-violet-600 bg-violet-500/10" },
  post_suggestion: { label: "Tech post idea", icon: FileCode, color: "text-amber-600 bg-amber-500/10" },
}

function bodyText(body: ContentRow["content"]["body"]): string {
  if (!body) return ""
  if (typeof body === "string") return body
  // Some bodies are JSON objects with a text/content field
  const b = body as Record<string, unknown>
  return String(b.text ?? b.content ?? b.body ?? b.post ?? JSON.stringify(body, null, 2))
}

function ContentCard({
  row,
  onApprove,
  onDismiss,
}: {
  row: ContentRow
  onApprove: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState<"approve" | "dismiss" | null>(null)
  const meta = CONTENT_TYPE_META[row.content.contentType ?? "post"] ?? CONTENT_TYPE_META.post
  const Icon = meta.icon
  const text = bodyText(row.content.body)
  const preview = text.slice(0, 180)
  const hasMore = text.length > 180
  const age = formatDistanceToNow(new Date(row.created_at), { addSuffix: true })
  const isPending = row.content.status === "pending_approval"

  const handleApprove = async () => {
    setLoading("approve")
    await fetch(`/api/intelligence/content/${row.id}/approve`, { method: "POST" })
    onApprove(row.id)
  }

  const handleDismiss = async () => {
    setLoading("dismiss")
    await fetch(`/api/intelligence/content/${row.id}/approve`, { method: "DELETE" })
    onDismiss(row.id)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", meta.color)}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-semibold text-foreground">{meta.label}</span>
            {isPending && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                Needs approval
              </span>
            )}
            {row.content.status === "draft" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                Draft
              </span>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto">{age}</span>
          </div>

          {text && (
            <div className="mt-2">
              <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {expanded ? text : preview}
                {!expanded && hasMore && "…"}
              </p>
              {hasMore && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[12px] text-primary hover:text-primary/80 flex items-center gap-0.5 mt-1"
                >
                  {expanded ? <><ChevronUp className="h-3 w-3" /> Less</> : <><ChevronDown className="h-3 w-3" /> Read more</>}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              className="h-7 text-[12px] gap-1.5"
              onClick={handleApprove}
              disabled={loading !== null}
            >
              {loading === "approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[12px] gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
              disabled={loading !== null}
            >
              {loading === "dismiss" ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ContentQueue() {
  const [items, setItems] = useState<ContentRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/intelligence/feed")
      if (!res.ok) return
      const data = await res.json()
      setItems(data.contentQueue ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const removeItem = (id: string) => setItems((prev) => prev.filter((r) => r.id !== id))

  const pendingCount = items.filter((r) => r.content.status === "pending_approval").length

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading content queue…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
        <Megaphone className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-[13px] text-muted-foreground">No content in queue.</p>
        <p className="text-[12px] text-muted-foreground/70 mt-1">
          The CMO pipeline generates LinkedIn drafts at 08:00, 12:00, and 16:00 on weekdays.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Content queue</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {pendingCount > 0
              ? `${pendingCount} item${pendingCount !== 1 ? "s" : ""} need your approval before going live`
              : "All drafts — review and approve to publish"}
          </p>
        </div>
        <span className="text-[12px] text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-3">
        {items.map((row) => (
          <ContentCard
            key={row.id}
            row={row}
            onApprove={removeItem}
            onDismiss={removeItem}
          />
        ))}
      </div>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Copy,
  Loader2,
  RefreshCw,
  Send,
  SkipForward,
  CalendarClock,
  Pencil,
  Sparkles,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { isManualOutreachEmail } from "@/lib/juno/theorg"

const LOOKALIKE_OPTIONS: { value: string; label: string }[] = [
  { value: "contacted", label: "Contacted" },
  { value: "no_response", label: "No response" },
  { value: "replied", label: "Replied" },
  { value: "meeting", label: "Meeting booked" },
  { value: "closed_won", label: "Closed won" },
  { value: "closed_lost", label: "Closed lost" },
  { value: "not_icp", label: "Not ICP" },
]

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export type OutreachRow = {
  id: string
  lead_id: string | null
  lookalike_profile_id: string | null
  to_name: string
  to_email: string
  to_title: string | null
  to_company: string | null
  subject: string
  body: string
  channel: string
  status: string
  sent_at: string | null
  resend_message_id: string | null
  provider: string | null
  provider_message_id: string | null
  provider_thread_id: string | null
  provider_inbox_id: string | null
  opened_at: string | null
  clicked_at: string | null
  replied_at: string | null
  outcome: string | null
  outcome_notes: string | null
  scheduled_for: string | null
  skipped_reason: string | null
  created_at: string
  updated_at: string
}

function effectiveOutreachStatus(row: OutreachRow): string {
  if (row.replied_at) return "replied"
  return row.status
}

function outreachBadgeClass(status: string): string {
  switch (status) {
    case "drafted":
      return "bg-muted text-muted-foreground"
    case "approved":
      return "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
    case "sent":
    case "delivered":
      return "bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-200"
    case "opened":
    case "clicked":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200"
    case "replied":
      return "bg-violet-100 text-violet-900 dark:bg-violet-950/80 dark:text-violet-200"
    case "bounced":
    case "complained":
    case "rejected":
      return "bg-red-100 text-red-900 dark:bg-red-950/80 dark:text-red-200"
    case "skipped":
      return "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export function GtmMotionPanel() {
  const { toast } = useToast()
  const [items, setItems] = useState<OutreachRow[]>([])
  const [loading, setLoading] = useState(true)
  /** True while soft-refreshing (sync button) — keeps list mounted. */
  const [refreshing, setRefreshing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftSubject, setDraftSubject] = useState("")
  const [draftBody, setDraftBody] = useState("")
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [skipReason, setSkipReason] = useState("")
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [scheduleIso, setScheduleIso] = useState("")
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [markingSentId, setMarkingSentId] = useState<string | null>(null)
  const [outcomePick, setOutcomePick] = useState<Record<string, string>>({})
  const [outcomeNotes, setOutcomeNotes] = useState<Record<string, string>>({})

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setRefreshing(true)
      else setLoading(true)
      try {
        const r = await fetch("/api/outreach?status=all", { credentials: "include" })
        const j = (await r.json()) as { items?: OutreachRow[]; error?: string }
        if (!r.ok) throw new Error(j.error || "Failed to load")
        setItems(j.items ?? [])
      } catch (e) {
        toast({
          title: "Could not load outreach queue",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        })
      } finally {
        if (opts?.soft) setRefreshing(false)
        else setLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    void load()
  }, [load])

  const pending = useMemo(
    () => items.filter((i) => ["drafted", "approved"].includes(i.status)),
    [items],
  )

  /** Sent / skipped / bounced — anything that is not an active draft. */
  const otherRows = useMemo(
    () => items.filter((i) => !["drafted", "approved"].includes(i.status)),
    [items],
  )

  const feedbackRows = useMemo(
    () =>
      items.filter(
        (i) =>
          ["sent", "delivered", "opened", "clicked"].includes(i.status) &&
          !i.outcome?.trim(),
      ),
    [items],
  )

  function startEdit(row: OutreachRow) {
    setEditingId(row.id)
    setDraftSubject(row.subject)
    setDraftBody(row.body)
  }

  async function saveEdit(id: string) {
    try {
      const r = await fetch(`/api/outreach/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: draftSubject, body: draftBody }),
      })
      const j = (await r.json()) as { error?: string }
      if (!r.ok) throw new Error(j.error || "Save failed")
      setEditingId(null)
      await load()
      toast({ title: "Draft updated" })
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  async function copyDraft(row: OutreachRow) {
    const text = `Subject: ${row.subject}\n\n${row.body}`
    const ok = await copyText(text)
    toast({
      title: ok ? "Copied to clipboard" : "Copy failed",
      description: ok ? "Paste into your mail client and send when ready." : undefined,
      variant: ok ? undefined : "destructive",
    })
  }

  async function markSentManually(id: string) {
    setMarkingSentId(id)
    try {
      const r = await fetch(`/api/outreach/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_sent_manually: true }),
      })
      const j = (await r.json()) as { error?: string }
      if (!r.ok) throw new Error(j.error || "Update failed")
      await load()
      toast({ title: "Marked as sent", description: "Log outcome below once you hear back." })
    } catch (e) {
      toast({
        title: "Could not update",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setMarkingSentId(null)
    }
  }

  async function sendOne(id: string) {
    setSendingId(id)
    try {
      const r = await fetch(`/api/outreach/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      })
      const j = (await r.json()) as { error?: string; messageId?: string }
      if (!r.ok) throw new Error(j.error || "Send failed")
      await load()
      toast({ title: "Email sent", description: j.messageId ? `Id: ${j.messageId}` : undefined })
    } catch (e) {
      toast({
        title: "Send failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSendingId(null)
    }
  }

  async function skipOne(id: string) {
    const reason = skipReason.trim() || "skipped by founder"
    try {
      const r = await fetch(`/api/outreach/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "skipped", skipped_reason: reason }),
      })
      const j = (await r.json()) as { error?: string }
      if (!r.ok) throw new Error(j.error || "Skip failed")
      setSkipReason("")
      await load()
      toast({ title: "Archived", description: reason })
    } catch (e) {
      toast({
        title: "Skip failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  async function syncLookalikeOutcome(id: string) {
    const lo = outcomePick[id]?.trim()
    if (!lo) {
      toast({ title: "Pick an outcome", variant: "destructive" })
      return
    }
    setSyncingId(id)
    try {
      const r = await fetch(`/api/outreach/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sync_lookalike: true,
          lookalike_outcome: lo,
          outcome_notes: outcomeNotes[id]?.trim() || null,
        }),
      })
      const j = (await r.json()) as {
        error?: string
        lookalike?: { refined?: boolean; refinementNote?: string; outcomesTotal?: number }
      }
      if (!r.ok) throw new Error(j.error || "Sync failed")
      await load()
      toast({
        title: "Lookalike updated",
        description: j.lookalike?.refined
          ? j.lookalike.refinementNote?.slice(0, 120) || "Profile refined"
          : `Outcomes recorded: ${j.lookalike?.outcomesTotal ?? "—"}`,
      })
    } catch (e) {
      toast({
        title: "Sync failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSyncingId(null)
    }
  }

  async function rescheduleOne(id: string) {
    if (!scheduleIso) {
      toast({ title: "Pick a date", variant: "destructive" })
      return
    }
    try {
      const r = await fetch(`/api/outreach/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          scheduled_for: new Date(scheduleIso).toISOString(),
        }),
      })
      const j = (await r.json()) as { error?: string }
      if (!r.ok) throw new Error(j.error || "Schedule failed")
      setScheduleId(null)
      setScheduleIso("")
      await load()
      toast({ title: "Scheduled" })
    } catch (e) {
      toast({
        title: "Schedule failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-6 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading outreach queue…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Outreach queue
          </p>
          <p className="text-sm text-muted-foreground">
            {"Jack & Jill"} leads (7+ ICP) → TheOrg org chart + Claude drafts. Copy and send from your inbox; in-app
            sending uses the configured provider.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={refreshing}
            title="Reload queue from server (status, opens, sends)"
            onClick={() => void load({ soft: true })}
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />
            Sync
          </Button>
          <span className="rounded-md bg-muted px-2.5 py-1 text-[12px] font-medium text-foreground">
            {pending.length} draft{pending.length === 1 ? "" : "s"} · {items.length} total
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/15 px-6 py-10 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No outreach rows yet</p>
          <p className="mt-2">
            When a lead scores 7+ on ICP fit, the GTM pipeline saves drafts here (Inngest{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[12px]">juno/lead.qualified</code>). If you expected
            rows, confirm the migration <code className="rounded bg-muted px-1 py-0.5 text-[12px]">outreach_log</code>{" "}
            is applied and the pipeline ran.
          </p>
        </div>
      ) : pending.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          No drafts in queue right now (everything is sent, skipped, or archived). See{" "}
          <span className="font-medium text-foreground">Recent outreach</span> below if you have older rows.
        </p>
      ) : null}

      {pending.length > 0 ? (
        <ul className="space-y-4">
          {pending.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    To: {row.to_name}
                    {row.to_title ? ` — ${row.to_title}` : ""}
                    {row.to_company ? ` at ${row.to_company}` : ""}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {row.to_email}
                    {isManualOutreachEmail(row.to_email) ? (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950/80 dark:text-amber-200">
                        Find email — send manually
                      </span>
                    ) : null}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium capitalize",
                    outreachBadgeClass(effectiveOutreachStatus(row)),
                  )}
                >
                  {effectiveOutreachStatus(row)}
                </span>
              </div>

              {editingId === row.id ? (
                <div className="mt-3 space-y-2">
                  <Label className="text-[11px]">Subject</Label>
                  <Input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} />
                  <Label className="text-[11px]">Body</Label>
                  <Textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    rows={12}
                    className="font-mono text-[13px] leading-relaxed"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void saveEdit(row.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-[13px] font-medium text-foreground">Subject: {row.subject}</p>
                  <pre
                    className={cn(
                      "mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-[13px] leading-relaxed text-foreground",
                    )}
                  >
                    {row.body}
                  </pre>
                </>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {editingId !== row.id ? (
                  <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  onClick={() => void copyDraft(row)}
                  disabled={editingId === row.id}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void markSentManually(row.id)}
                  disabled={markingSentId === row.id || editingId === row.id}
                >
                  {markingSentId === row.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Mark sent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-muted-foreground"
                  onClick={() => void sendOne(row.id)}
                  disabled={sendingId === row.id || editingId === row.id}
                  title="Requires AGENTMAIL_API_KEY + AGENTMAIL_INBOX_ID (AgentMail inbox ID), or legacy Resend envs"
                >
                  {sendingId === row.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Send via app
                </Button>
                <div className="flex flex-1 flex-wrap items-end gap-2">
                  <Input
                    placeholder="Skip reason (optional)"
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    className="max-w-xs text-[13px]"
                  />
                  <Button size="sm" variant="secondary" onClick={() => void skipOne(row.id)}>
                    <SkipForward className="mr-1.5 h-3.5 w-3.5" />
                    Skip
                  </Button>
                </div>
              </div>

              {scheduleId === row.id ? (
                <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
                  <div>
                    <Label className="text-[11px]">Remind / schedule</Label>
                    <Input
                      type="datetime-local"
                      value={scheduleIso}
                      onChange={(e) => setScheduleIso(e.target.value)}
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void rescheduleOne(row.id)}>
                    <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                    Save schedule
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setScheduleId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => {
                    setScheduleId(row.id)
                    setScheduleIso("")
                  }}
                >
                  <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                  Reschedule
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {otherRows.length > 0 ? (
        <div className="space-y-3 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recent outreach
          </p>
          <ul className="space-y-3">
            {otherRows.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-border bg-card/80 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {row.to_name}
                      {row.to_title ? ` — ${row.to_title}` : ""}
                      {row.to_company ? ` · ${row.to_company}` : ""}
                    </p>
                    <p className="text-[12px] text-muted-foreground line-clamp-1">{row.subject}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium capitalize",
                      outreachBadgeClass(effectiveOutreachStatus(row)),
                    )}
                  >
                    {effectiveOutreachStatus(row)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void copyDraft(row)}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {feedbackRows.length > 0 ? (
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sent — log outcome → lookalike
            </p>
          </div>
          <p className="text-[13px] text-muted-foreground">
            After you send from your inbox (or via the app), log the result here. This feeds the same lookalike
            feedback loop as the Lookalike tab.
          </p>
          <ul className="space-y-3">
            {feedbackRows.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <p className="text-sm font-medium text-foreground">
                  {row.to_name}
                  {row.to_company ? ` · ${row.to_company}` : ""}
                </p>
                <p className="text-[12px] text-muted-foreground">{row.subject}</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px]">Outcome</Label>
                    <Select
                      value={outcomePick[row.id] ?? ""}
                      onValueChange={(v) => setOutcomePick((m) => ({ ...m, [row.id]: v }))}
                    >
                      <SelectTrigger className="w-full sm:max-w-xs">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOOKALIKE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px]">Notes (optional)</Label>
                    <Input
                      placeholder="e.g. referred to CDIO"
                      value={outcomeNotes[row.id] ?? ""}
                      onChange={(e) =>
                        setOutcomeNotes((m) => ({ ...m, [row.id]: e.target.value }))
                      }
                      className="text-[13px]"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={syncingId === row.id || !row.lookalike_profile_id}
                    title={
                      row.lookalike_profile_id
                        ? undefined
                        : "No lookalike profile on this row — drafts from an active lookalike playbook get a profile id."
                    }
                    onClick={() => void syncLookalikeOutcome(row.id)}
                  >
                    {syncingId === row.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Sync to lookalike
                  </Button>
                </div>
                {!row.lookalike_profile_id ? (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Lookalike sync needs a profile on this outreach. Create/activate a lookalike profile and generate new
                    drafts, or log outcomes from the Lookalike tab.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

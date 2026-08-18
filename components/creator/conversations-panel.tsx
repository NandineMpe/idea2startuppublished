"use client"

import { useState } from "react"
import { Check, Clock, Copy, MessageSquare, Send } from "lucide-react"
import {
  daysSilent,
  followUpDue,
  followUpsSent,
  FOLLOW_UP_DUE_DAYS,
  MAX_FOLLOW_UPS,
  type ConversationMessage,
  type ConversationState,
  type CreatorConversation,
} from "@/lib/creator/deals/conversations"
import type { FollowUpDraft } from "@/lib/creator/deals/follow-up"

/**
 * Open brand conversations, and the follow-up nobody remembers to send.
 *
 * The screen exists because most deals are lost to silence rather than to a no,
 * and chasing means first remembering who has not replied. Sorting by days
 * silent puts the forgotten thread at the top, which is the only ordering that
 * makes this a working list rather than an archive.
 */
export function ConversationsPanel({ conversations }: { conversations: CreatorConversation[] }) {
  const open = conversations.filter((c) => c.state === "open")
  if (!conversations.length) return null

  // Longest silence first: the thread most likely to be forgotten is the one
  // that most needs to be on top.
  const sorted = [...open].sort((a, b) => (daysSilent(b) ?? -1) - (daysSilent(a) ?? -1))
  const closed = conversations.filter((c) => c.state !== "open")

  return (
    <section className="rounded-xl border border-border bg-card p-5 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <h2 className="text-[13px] font-semibold text-foreground">Brand conversations</h2>
        <span className="text-[11px] text-muted-foreground tabular-nums">{open.length} open</span>
      </div>
      <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed">
        Most deals are lost to silence, not to a no. Follow-ups are due at {FOLLOW_UP_DUE_DAYS.join(", ")} days,
        and stop after {MAX_FOLLOW_UPS}.
      </p>

      <div className="grid gap-3">
        {sorted.map((c) => (
          <ConversationRow key={c.id} conversation={c} />
        ))}
        {closed.length > 0 && (
          <p className="text-[11px] text-muted-foreground pt-1">
            {closed.length} closed: {closed.filter((c) => c.state === "won").length} won,{" "}
            {closed.filter((c) => c.state === "lost").length} lost,{" "}
            {closed.filter((c) => c.state === "replied").length} replied.
          </p>
        )}
      </div>
    </section>
  )
}

function ConversationRow({ conversation }: { conversation: CreatorConversation }) {
  const [messages, setMessages] = useState<ConversationMessage[]>(conversation.messages)
  const [sentAt, setSentAt] = useState<string | null>(conversation.sent_at)
  const [lastContact, setLastContact] = useState<string | null>(conversation.last_contact_at)
  const [state, setState] = useState<ConversationState>(conversation.state)
  const [draft, setDraft] = useState<FollowUpDraft | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const live = { ...conversation, messages, sent_at: sentAt, last_contact_at: lastContact, state }
  const silent = daysSilent(live)
  const sent = followUpsSent(live)
  const due = followUpDue(live)
  const unsent = messages.filter((m) => !m.sent_at)

  async function post(payload: Record<string, unknown>, label: string) {
    setPending(label)
    setError(null)
    try {
      const res = await fetch("/api/creator/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversation.id, ...payload }),
      })
      const data = (await res.json()) as {
        draft?: FollowUpDraft
        message?: ConversationMessage
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? `Failed (HTTP ${res.status})`)
        return null
      }
      return data
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.")
      return null
    } finally {
      setPending(null)
    }
  }

  async function drawFollowUp() {
    const data = await post({}, "draft")
    if (data?.draft && data.message) {
      setDraft(data.draft)
      setMessages((m) => [...m, data.message as ConversationMessage])
    }
  }

  async function send(seq: number) {
    const data = await post({ action: "mark_sent", seq }, `sent-${seq}`)
    if (data) {
      const now = new Date().toISOString()
      setMessages((m) => m.map((x) => (x.seq === seq ? { ...x, sent_at: x.sent_at ?? now } : x)))
      setSentAt((s) => s ?? now)
      setLastContact(now)
    }
  }

  async function close(next: ConversationState) {
    const data = await post({ action: "set_state", state: next }, `state-${next}`)
    if (data) setState(next)
  }

  async function copyBody(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">
            {conversation.brand ?? "Unnamed brand"}
            {conversation.quoted_total !== null && (
              <span className="text-muted-foreground font-normal tabular-nums">
                {" "}
                · {conversation.currency ?? "USD"} {conversation.quoted_total.toLocaleString()}
              </span>
            )}
          </p>
          {conversation.what_they_want && (
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
              {conversation.what_they_want}
            </p>
          )}
        </div>

        {/* Days of silence, escalating. Once a follow-up is due the badge is the
            call to action, so it stops being grey. */}
        <span
          className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
            due
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Clock className="h-3 w-3" />
          {silent === null ? "not sent" : silent === 0 ? "sent today" : `${silent}d silent`}
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground mt-2">
        {sent === 0 ? "No follow-up sent" : `${sent} of ${MAX_FOLLOW_UPS} follow-ups sent`}
        {due && ` · number ${sent + 1} is due`}
        {!sentAt && " · mark the reply as sent to start the clock"}
      </p>

      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        {unsent.map((m) => (
          <button
            key={m.seq}
            onClick={() => send(m.seq)}
            disabled={pending !== null}
            className="inline-flex items-center gap-1.5 h-7 rounded-md bg-violet-600 px-2.5 text-[12px] font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            <Send className="h-3 w-3" />
            {pending === `sent-${m.seq}`
              ? "Marking…"
              : `Mark ${m.kind === "reply" ? "reply" : "follow-up"} sent`}
          </button>
        ))}

        <button
          onClick={drawFollowUp}
          disabled={pending !== null || !sentAt || sent >= MAX_FOLLOW_UPS}
          title={!sentAt ? "Mark the first email as sent first" : undefined}
          className="inline-flex items-center gap-1.5 h-7 rounded-md border border-border px-2.5 text-[12px] font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {pending === "draft" ? "Writing…" : `Draft follow-up ${sent + 1}`}
        </button>

        <button
          onClick={() => close("replied")}
          disabled={pending !== null}
          className="h-7 rounded-md border border-border px-2.5 text-[12px] text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          They replied
        </button>
        <button
          onClick={() => close("won")}
          disabled={pending !== null}
          className="h-7 rounded-md border border-border px-2.5 text-[12px] text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          Won
        </button>
        <button
          onClick={() => close("lost")}
          disabled={pending !== null}
          className="h-7 rounded-md border border-border px-2.5 text-[12px] text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          Lost
        </button>
      </div>

      {error && <p className="text-[12px] text-red-600 dark:text-red-400 mt-2">{error}</p>}

      {draft && (
        <div className="mt-3 grid gap-2">
          {/* Her read on the thread, kept out of the copyable block so it can
              never be pasted into the email by accident. */}
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground/80">Approach:</span> {draft.approach}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
              <span className="font-medium text-foreground/80">Honest read:</span> {draft.read}
            </p>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
              <span className="text-[11px] text-muted-foreground truncate">
                {draft.kind === "breakup" ? "Closing the file" : `Follow-up ${draft.step}`} · {draft.subject}
              </span>
              <button
                onClick={() => copyBody(draft.body)}
                className="shrink-0 inline-flex items-center gap-1.5 h-7 rounded-md border border-border px-2.5 text-[12px] font-medium text-foreground hover:bg-accent transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="px-3 py-2.5 text-[13px] text-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {draft.body}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

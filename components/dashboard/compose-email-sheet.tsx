"use client"

import { useState } from "react"
import { Mail, Sparkles, Send, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type Mode = "compose" | "drafting" | "sending" | "sent" | "error"

interface ComposeState {
  to: string
  toName: string
  subject: string
  body: string
  hint: string
}

const empty: ComposeState = { to: "", toName: "", subject: "", body: "", hint: "" }

export function ComposeEmailSheet() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("compose")
  const [form, setForm] = useState<ComposeState>(empty)
  const [errorMsg, setErrorMsg] = useState("")

  function set(field: keyof ComposeState, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleOpen() {
    setOpen(true)
    setMode("compose")
    setForm(empty)
    setErrorMsg("")
  }

  async function handleAiDraft() {
    if (!form.to.trim()) return
    setMode("drafting")
    setErrorMsg("")
    try {
      const res = await fetch("/api/email/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: form.to, toName: form.toName || undefined, hint: form.hint || undefined }),
      })
      const data = await res.json() as { subject?: string; body?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Draft failed")
      setForm((f) => ({ ...f, subject: data.subject ?? f.subject, body: data.body ?? f.body }))
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Draft failed")
    } finally {
      setMode("compose")
    }
  }

  async function handleSend() {
    const { to, subject, body } = form
    if (!to.trim() || !subject.trim() || !body.trim()) return
    setMode("sending")
    setErrorMsg("")
    try {
      const res = await fetch("/api/email/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: form.to, toName: form.toName || undefined, subject: form.subject, body: form.body }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Send failed")
      setMode("sent")
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Send failed")
      setMode("error")
    }
  }

  const isBusy = mode === "drafting" || mode === "sending"
  const canSend = form.to.trim() && form.subject.trim() && form.body.trim() && !isBusy
  const canDraft = form.to.trim() && !isBusy

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={handleOpen}
        aria-label="Compose email"
        title="Compose email"
      >
        <Mail className="h-4 w-4" />
      </Button>

      <Sheet open={open} onOpenChange={(o) => { if (!isBusy) setOpen(o) }}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="shrink-0 border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Compose email
              </SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => { if (!isBusy) setOpen(false) }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {mode === "sent" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Email sent</p>
              <p className="text-xs text-muted-foreground">
                Delivered to <span className="font-medium">{form.to}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => { setForm(empty); setMode("compose") }}
              >
                Compose another
              </Button>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
              {/* Recipient */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ce-to" className="text-xs text-muted-foreground">
                    To *
                  </Label>
                  <Input
                    id="ce-to"
                    type="email"
                    placeholder="name@company.com"
                    value={form.to}
                    onChange={(e) => set("to", e.target.value)}
                    disabled={isBusy}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ce-name" className="text-xs text-muted-foreground">
                    Name (optional)
                  </Label>
                  <Input
                    id="ce-name"
                    placeholder="First name"
                    value={form.toName}
                    onChange={(e) => set("toName", e.target.value)}
                    disabled={isBusy}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* AI draft section */}
              <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  AI draft
                </p>
                <Input
                  placeholder="Optional context hint — e.g. 'scaling their finance team'"
                  value={form.hint}
                  onChange={(e) => set("hint", e.target.value)}
                  disabled={isBusy}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={!canDraft}
                  onClick={handleAiDraft}
                >
                  {mode === "drafting" ? (
                    <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Researching &amp; drafting…</>
                  ) : (
                    <><Sparkles className="mr-1.5 h-3 w-3" /> Generate draft</>
                  )}
                </Button>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="ce-subject" className="text-xs text-muted-foreground">
                  Subject *
                </Label>
                <Input
                  id="ce-subject"
                  placeholder="Subject line"
                  value={form.subject}
                  onChange={(e) => set("subject", e.target.value)}
                  disabled={isBusy}
                  className="h-8 text-sm"
                />
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col space-y-1.5">
                <Label htmlFor="ce-body" className="text-xs text-muted-foreground">
                  Message *
                </Label>
                <Textarea
                  id="ce-body"
                  placeholder="Write your message…"
                  value={form.body}
                  onChange={(e) => set("body", e.target.value)}
                  disabled={isBusy}
                  className="min-h-[200px] flex-1 resize-none text-sm"
                />
              </div>

              {/* Error */}
              {(mode === "error" || errorMsg) && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {errorMsg}
                </p>
              )}

              {/* Send */}
              <Button
                className="w-full"
                disabled={!canSend}
                onClick={handleSend}
              >
                {mode === "sending" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" /> Send</>
                )}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

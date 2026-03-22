"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ExternalLink } from "lucide-react"

type SaveStatus = "idle" | "saving" | "saved" | "needs_sandbox" | "error"

export function WhatsAppSetup() {
  const [phone, setPhone] = useState("")
  const [status, setStatus] = useState<SaveStatus>("idle")
  const [verified, setVerified] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    fetch("/api/settings/whatsapp")
      .then((r) => r.json())
      .then((data: { whatsappNumber?: string | null; verified?: boolean }) => {
        if (data.whatsappNumber) setPhone(data.whatsappNumber)
        if (data.verified) setVerified(true)
      })
      .catch(() => {})
  }, [])

  async function handleSave() {
    setStatus("saving")
    setErrorMsg("")

    try {
      const res = await fetch("/api/settings/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappNumber: phone.trim() ? phone.trim() : null }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        setErrorMsg(typeof data.error === "string" ? data.error : "Request failed")
        return
      }

      if (data.removed) {
        setStatus("saved")
        setVerified(false)
        setPhone("")
        return
      }

      if (data.needsSandboxJoin || data.testError === "sandbox_not_joined") {
        setStatus("needs_sandbox")
        setVerified(false)
        return
      }

      if (data.verified) {
        setStatus("saved")
        setVerified(true)
        return
      }

      setStatus("saved")
    } catch {
      setStatus("error")
      setErrorMsg("Failed to save")
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">WhatsApp notifications</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Receive your daily brief, lead alerts, and content approvals on WhatsApp. Use international
          format (E.164), e.g. +353861234567.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="space-y-2 flex-1">
          <Label htmlFor="whatsapp-phone">Mobile number</Label>
          <Input
            id="whatsapp-phone"
            type="tel"
            placeholder="+353861234567"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setStatus("idle")
            }}
            className="font-mono text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={handleSave} disabled={status === "saving"} variant="default">
            {status === "saving" ? "Saving…" : phone.trim() ? "Save & verify" : "Remove"}
          </Button>
        </div>
      </div>

      {status === "saved" && verified && (
        <Alert className="border-green-500/40 bg-green-500/5">
          <AlertTitle className="text-green-700 dark:text-green-400">Connected</AlertTitle>
          <AlertDescription>Check WhatsApp for a confirmation message.</AlertDescription>
        </Alert>
      )}

      {status === "saved" && !phone && (
        <p className="text-sm text-muted-foreground">WhatsApp notifications disabled.</p>
      )}

      {status === "needs_sandbox" && (
        <Alert className="border-amber-500/50 bg-amber-500/5">
          <AlertTitle className="text-amber-900 dark:text-amber-200">
            Join the Twilio WhatsApp sandbox
          </AlertTitle>
          <AlertDescription className="space-y-3 text-amber-900/90 dark:text-amber-100/90">
            <p>
              From WhatsApp, send the join message to{" "}
              <strong className="font-mono">+1 415 523 8886</strong> using the code from your Twilio
              console (e.g. <code className="rounded bg-background/80 px-1">join &lt;code&gt;</code>).
            </p>
            <p className="text-xs">
              <a
                href="https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline font-medium text-foreground"
              >
                Twilio → Messaging → Try WhatsApp <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <Button type="button" variant="outline" size="sm" onClick={handleSave}>
              I’ve joined — verify again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {status === "error" && (
        <p className="text-sm text-destructive">Error: {errorMsg}</p>
      )}

      {verified && status !== "needs_sandbox" && (
        <p className="text-xs text-muted-foreground">
          Daily brief (~5am), lead alerts as they qualify, and content drafts for approval are sent here
          when Twilio is configured on the deployment.
        </p>
      )}
    </div>
  )
}

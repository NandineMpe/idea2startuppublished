"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Mic,
  MicOff,
  Upload,
  PenLine,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AgentActivation } from "@/components/onboarding/agent-activation"

// ─── types ────────────────────────────────────────────────────────────────────

type Mode = "choose" | "upload" | "speak" | "write" | "activate" | "done"

const LLM_EXPORT_TIPS = [
  {
    name: "Chat assistant",
    steps: [
      "Open a conversation where you've discussed your startup.",
      'Paste this prompt: "Summarise everything you know about my startup — product, market, team, goals — as a detailed markdown document."',
      "Copy the response, save as a .md or .txt file, then upload below.",
    ],
  },
  {
    name: "Another project or thread",
    steps: [
      "Open any project or conversation with company context.",
      'Prompt: "Export a full markdown summary of my startup context — product, market, team, goals, traction."',
      "Copy the output and save as a .md file.",
    ],
  },
  {
    name: "Notes or documents",
    steps: [
      "Open your strategy doc, pitch deck notes, or founder journal.",
      'Export as Markdown (.md) or plain text (.txt) from your notes app (use Export or Download).',
      "Upload the exported file below.",
    ],
  },
]

// ─── shared util ──────────────────────────────────────────────────────────────

async function markOnboardingComplete() {
  await fetch("/api/company/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ company_name: "My Company" }),
  }).catch(() => {})
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ContextImportanceCard() {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Why context matters</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Juno's agents — daily briefs, lead scoring, market intelligence — all run on your
            startup context. The richer the context, the sharper every output. Founders who add
            context on day one see relevant, personalised insights from the first brief.
          </p>
        </div>
      </div>
    </div>
  )
}

function OptionCard({
  icon,
  title,
  description,
  onClick,
  highlight = false,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition-all hover:shadow-md ${
        highlight
          ? "border-primary/30 bg-primary/5 hover:border-primary/60 hover:bg-primary/10"
          : "border-border bg-card hover:border-primary/30 hover:bg-muted/40"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
          highlight
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  )
}

// ─── Upload mode ──────────────────────────────────────────────────────────────

function UploadMode({ onDone }: { onDone: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openTip, setOpenTip] = useState<number | null>(null)

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    setUploading(true)
    const names: string[] = []
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("type", "document")
        const res = await fetch("/api/company/assets", { method: "POST", body: fd })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(typeof d.error === "string" ? d.error : "Upload failed")
        }
        names.push(file.name)
      }
      setUploaded((p) => [...p, ...names])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Step 1 of 2
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Upload AI context</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Export a markdown summary from your current AI, then upload it here.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          How to export from another AI
        </p>
        {LLM_EXPORT_TIPS.map((tip, i) => (
          <div key={tip.name} className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
              onClick={() => setOpenTip(openTip === i ? null : i)}
            >
              {tip.name}
              {openTip === i ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {openTip === i && (
              <ol className="px-4 pb-4 space-y-2.5">
                {tip.steps.map((step, j) => (
                  <li key={j} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {j + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>

      <label
        htmlFor="ob-upload"
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border px-6 py-10 transition-colors hover:bg-muted/40"
      >
        <input
          id="ob-upload"
          type="file"
          accept=".pdf,.doc,.docx,.md,.txt,.html,.csv"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => uploadFiles(e.target.files)}
        />
        <Upload className="h-7 w-7 text-muted-foreground" />
        <span className="mt-3 text-sm font-medium">Drop files or click to upload</span>
        <span className="mt-1 text-xs text-muted-foreground">Markdown, PDF, Word, plain text</span>
      </label>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {uploaded.length > 0 && (
        <ul className="space-y-1.5">
          {uploaded.map((name) => (
            <li key={name} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {name}
            </li>
          ))}
        </ul>
      )}

      <Button onClick={onDone} disabled={uploading} className="w-full">
        {uploading ? "Uploading…" : uploaded.length > 0 ? "Continue →" : "Continue without uploading"}
      </Button>
    </div>
  )
}

// ─── Speak mode ───────────────────────────────────────────────────────────────

function SpeakMode({ onDone }: { onDone: () => void }) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  function startRecording() {
    setError(null)
    const SpeechRecognitionAPI =
      (typeof window !== "undefined" &&
        (window.SpeechRecognition || (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition)) ||
      null

    if (!SpeechRecognitionAPI) {
      setError("Voice input isn't supported in this browser. Please use Chrome, or type your context instead.")
      return
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    let finalText = ""

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += (result[0]?.transcript ?? "") + " "
        } else {
          interim += result[0]?.transcript ?? ""
        }
      }
      setTranscript((finalText + interim).trim())
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone access and try again.")
      } else if (event.error !== "no-speech") {
        setError("Voice recognition error. Please try again or type your context instead.")
      }
      setRecording(false)
    }

    recognition.onend = () => {
      setRecording(false)
    }

    recognition.start()
    recognitionRef.current = recognition
    setRecording(true)
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setRecording(false)
  }

  async function saveAndContinue() {
    if (!transcript.trim()) {
      onDone()
      return
    }
    setProcessing(true)
    try {
      const blob = new Blob([transcript], { type: "text/plain" })
      const fd = new FormData()
      fd.append("file", blob, "spoken-context.txt")
      fd.append("type", "document")
      await fetch("/api/company/assets", { method: "POST", body: fd })
      setSaved(true)
      setTimeout(onDone, 800)
    } catch {
      onDone()
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Step 1 of 2
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Speak your startup story</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Talk for 2–3 minutes. Your voice is transcribed live and Juno uses it as your foundation context.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground leading-relaxed">
        <p className="font-medium text-foreground mb-2">What to cover</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>What problem you're solving and for whom</li>
          <li>How your product works and your key differentiator</li>
          <li>Your current traction, stage, and team</li>
          <li>Your 6-month goals and biggest challenges</li>
        </ul>
      </div>

      <div className="flex flex-col items-center gap-4 py-4">
        {!recording && !transcript && (
          <>
            <button
              type="button"
              onClick={startRecording}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
            >
              <Mic className="h-8 w-8" />
            </button>
            <p className="text-xs text-muted-foreground">Tap the mic to start</p>
          </>
        )}

        {recording && (
          <>
            <div className="flex items-center gap-2 text-sm text-red-500 font-medium animate-pulse">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Listening — speak clearly
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-500 bg-red-50 text-red-600 transition-transform hover:scale-105 active:scale-95 dark:bg-red-950"
            >
              <MicOff className="h-8 w-8" />
            </button>
            <p className="text-xs text-muted-foreground">Tap to stop</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {transcript && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Transcript — edit if needed
            </p>
            <button
              type="button"
              onClick={() => { setTranscript(""); setError(null) }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Re-record
            </button>
          </div>
          <textarea
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            rows={8}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
          {recording && (
            <p className="text-xs text-muted-foreground">Still listening — tap the mic to stop when done.</p>
          )}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          Context saved!
        </div>
      )}

      <div className="flex gap-3">
        {transcript && !recording && (
          <Button onClick={saveAndContinue} disabled={processing} className="flex-1">
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & continue →
          </Button>
        )}
        {recording && (
          <Button onClick={stopRecording} variant="outline" className="flex-1">
            Stop recording
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onDone}
          disabled={processing}
          className={transcript && !recording ? "" : "w-full"}
        >
          {transcript ? "Skip saving" : "Continue without speaking"}
        </Button>
      </div>
    </div>
  )
}

// ─── Write mode ───────────────────────────────────────────────────────────────

function WriteMode({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!text.trim()) {
      onDone()
      return
    }
    setSaving(true)
    setError(null)
    try {
      const blob = new Blob([text], { type: "text/plain" })
      const fd = new FormData()
      fd.append("file", blob, "written-context.txt")
      fd.append("type", "document")
      const res = await fetch("/api/company/assets", { method: "POST", body: fd })
      if (!res.ok) throw new Error("Save failed")
      setSaved(true)
      setTimeout(onDone, 800)
    } catch {
      setError("Couldn't save. Click continue to proceed anyway.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Step 1 of 2
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Write your context</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A few paragraphs is enough. Cover your product, your market, your team, and your goals.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground leading-relaxed">
        <p className="font-medium text-foreground mb-2">Starter prompts — answer any of these</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>What problem does your startup solve and who has it?</li>
          <li>How does your product work and what makes it different?</li>
          <li>Where are you today — traction, stage, team size?</li>
          <li>What are your goals for the next 6 months?</li>
        </ul>
      </div>

      <textarea
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
        rows={10}
        placeholder="We're building a B2B SaaS that helps..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={saving}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          Context saved!
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving || !text.trim()} className="flex-1">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save & continue →
        </Button>
        <Button variant="outline" onClick={onDone} disabled={saving}>
          Skip
        </Button>
      </div>
    </div>
  )
}

// ─── Choose screen ────────────────────────────────────────────────────────────

function ChooseMode({ onChoose }: { onChoose: (m: "upload" | "speak" | "write" | "activate") => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Juno</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Before your first brief, give Juno context about your startup. Every agent — market
          intelligence, lead scoring, daily briefs — runs on this context. The more you share,
          the sharper your insights from day one.
        </p>
      </div>

      <ContextImportanceCard />

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          How would you like to add context?
        </p>

        <OptionCard
          icon={<FileText className="h-5 w-5" />}
          title="Upload from another AI"
          description="Export a markdown summary from the chat tool or notes app you already use, then upload it. Fastest way to get started."
          onClick={() => onChoose("upload")}
          highlight
        />

        <OptionCard
          icon={<Mic className="h-5 w-5" />}
          title="Speak your startup story"
          description="Talk for 2–3 minutes. We transcribe it into your foundation context."
          onClick={() => onChoose("speak")}
        />

        <OptionCard
          icon={<PenLine className="h-5 w-5" />}
          title="Write it yourself"
          description="Type a few paragraphs about your product, market, team, and goals. Takes about 5 minutes."
          onClick={() => onChoose("write")}
        />
      </div>

      <button
        type="button"
        onClick={() => onChoose("activate")}
        className="w-full py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Skip for now — I'll add context later in Settings
      </button>
    </div>
  )
}

// ─── Root flow ────────────────────────────────────────────────────────────────

export function OnboardingFlow() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("choose")

  async function handleActivationDone() {
    setMode("done")
    await markOnboardingComplete()
    setTimeout(() => router.push("/dashboard"), 2200)
  }

  return (
    <div className="mx-auto max-w-[600px] px-5 py-12">
      {mode === "choose" && <ChooseMode onChoose={(m) => setMode(m)} />}
      {mode === "upload" && <UploadMode onDone={() => setMode("activate")} />}
      {mode === "speak" && <SpeakMode onDone={() => setMode("activate")} />}
      {mode === "write" && <WriteMode onDone={() => setMode("activate")} />}
      {mode === "activate" && <AgentActivation onFinish={handleActivationDone} />}
      {mode === "done" && (
        <div className="pt-[18vh] text-center">
          <h2 className="text-xl font-semibold">Your first daily brief is on its way</h2>
          <p className="mt-2 text-sm text-muted-foreground">Opening your command centre…</p>
        </div>
      )}
    </div>
  )
}

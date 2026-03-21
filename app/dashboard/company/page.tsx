"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Building2,
  Save,
  Loader2,
  FileText,
  Link as LinkIcon,
  Eye,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Upload,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const PROFILE_FIELDS = [
  { key: "company_name", label: "Company Name", placeholder: "e.g. Acme Inc", type: "input" },
  { key: "tagline", label: "Tagline", placeholder: "One-line description", type: "input" },
  { key: "problem", label: "Problem", placeholder: "What problem do you solve?", type: "textarea" },
  { key: "solution", label: "Solution", placeholder: "How do you solve it?", type: "textarea" },
  { key: "target_market", label: "Target Market", placeholder: "Who are your customers?", type: "input" },
  { key: "industry", label: "Industry", placeholder: "e.g. B2B SaaS, HealthTech", type: "input" },
  { key: "stage", label: "Stage", placeholder: "e.g. Idea, MVP, Launched", type: "input" },
  { key: "traction", label: "Traction", placeholder: "Key metrics, users, revenue", type: "textarea" },
  { key: "team_summary", label: "Team Summary", placeholder: "Who's on the team?", type: "textarea" },
  { key: "funding_goal", label: "Funding Goal", placeholder: "e.g. $2M Seed", type: "input" },
] as const

const FOUNDER_FIELDS = [
  { key: "founder_name", label: "Your Name", placeholder: "Full name", type: "input" },
  { key: "founder_location", label: "Where You Are", placeholder: "City, country, timezone — e.g. San Francisco, PST", type: "input" },
  {
    key: "founder_background",
    label: "Your Background",
    placeholder: "What you've been doing: career path, education, experience, current focus. Full integration of where you are.",
    type: "textarea",
  },
] as const

const ALL_PROFILE_KEYS = [...PROFILE_FIELDS.map((f) => f.key), ...FOUNDER_FIELDS.map((f) => f.key)]

const STAGE_OPTIONS = ["Idea", "Pre-seed", "MVP", "Launched", "Growth"]

export default function CompanyProfilePage() {
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [assets, setAssets] = useState<Array<{ id: string; type: string; title: string; source_url: string | null; created_at: string }>>([])
  const [contextPreview, setContextPreview] = useState("")
  const [showContextPreview, setShowContextPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scrapeUrl, setScrapeUrl] = useState("")
  const [scraping, setScraping] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState<"document" | "pitch_deck">("document")
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/company/profile")
      const data = await res.json()
      if (data.profile) {
        const p: Record<string, string> = {}
        for (const k of ALL_PROFILE_KEYS) {
          p[k] = data.profile[k] ?? ""
        }
        setProfile(p)
      }
    } catch {
      setMessage({ text: "Failed to load profile", type: "error" })
    }
  }, [])

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/company/assets")
      const data = await res.json()
      setAssets(data.assets ?? [])
    } catch {
      setMessage({ text: "Failed to load assets", type: "error" })
    }
  }, [])

  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch("/api/company/context")
      const data = await res.json()
      setContextPreview(data.context ?? "")
    } catch {
      setContextPreview("Could not load context preview.")
    }
  }, [])

  useEffect(() => {
    fetchProfile()
    fetchAssets()
  }, [fetchProfile, fetchAssets])

  useEffect(() => {
    if (showContextPreview) fetchContext()
  }, [showContextPreview, fetchContext])

  const handleSaveProfile = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/company/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      if (!res.ok) throw new Error("Failed to save")
      setMessage({ text: "Profile saved", type: "success" })
    } catch {
      setMessage({ text: "Failed to save profile", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return
    setScraping(true)
    setMessage(null)
    try {
      const res = await fetch("/api/company/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed to scrape")
      }
      setMessage({ text: "URL scraped and saved", type: "success" })
      setScrapeUrl("")
      fetchAssets()
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Failed to scrape", type: "error" })
    } finally {
      setScraping(false)
    }
  }

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return
      setUploading(true)
      setMessage(null)
      let hasError = false
      try {
        for (const file of Array.from(files)) {
          try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("type", uploadType)
            const res = await fetch("/api/company/assets", {
              method: "POST",
              body: formData,
            })
            if (!res.ok) {
              const err = await res.json()
              throw new Error(err.error ?? "Upload failed")
            }
          } catch (err) {
            setMessage({ text: err instanceof Error ? err.message : "Upload failed", type: "error" })
            hasError = true
            break
          }
        }
        if (!hasError) {
          setMessage({ text: `${files.length} file(s) uploaded`, type: "success" })
          fetchAssets()
        }
      } finally {
        setUploading(false)
        e.target.value = ""
      }
    },
    [uploadType, fetchAssets],
  )

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Company Profile</h1>
            <p className="text-[13px] text-muted-foreground">
              Capture what you do. All agents use this context when addressing you.
            </p>
          </div>
        </div>
      </div>

      {/* Section D — Scrape from Web (first) */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-[15px] flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Scrape from Web
          </CardTitle>
          <CardDescription>Paste a URL to fetch and save its content for agents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="https://..."
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              className="text-[13px] h-9 bg-background"
            />
            <Button onClick={handleScrape} disabled={scraping || !scrapeUrl.trim()} className="gap-1.5">
              {scraping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Fetch & Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-[13px]",
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
              : "bg-amber-500/10 border border-amber-500/20 text-amber-500",
          )}
        >
          {message.type === "success" ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {message.text}
        </div>
      )}

      {/* Section A — Company Profile */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-[15px]">Company Profile</CardTitle>
          <CardDescription>Structured fields agents use to understand your startup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PROFILE_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">{f.label}</label>
              {f.type === "textarea" ? (
                <Textarea
                  value={profile[f.key] ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="text-[13px] min-h-[80px] bg-background"
                />
              ) : f.key === "stage" ? (
                <select
                  value={profile[f.key] ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-[13px] text-foreground"
                >
                  <option value="">Select stage</option>
                  {STAGE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={profile[f.key] ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="text-[13px] h-9 bg-background"
                />
              )}
            </div>
          ))}
          <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Founder Profile — where they are, what they've been doing */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-[15px] flex items-center gap-2">
            <User className="h-4 w-4" />
            Founder Profile
          </CardTitle>
          <CardDescription>
            Where you are and what you've been doing. Full integration so agents understand your context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {FOUNDER_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">{f.label}</label>
              {f.type === "textarea" ? (
                <Textarea
                  value={profile[f.key] ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="text-[13px] min-h-[120px] bg-background"
                />
              ) : (
                <Input
                  value={profile[f.key] ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="text-[13px] h-9 bg-background"
                />
              )}
            </div>
          ))}
          <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Section B & C — Pitch Deck + Documents */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-[15px]">Pitch Deck & Documents</CardTitle>
          <CardDescription>Upload PDF, TXT, MD, HTML, or CSV. Pitch deck replaces previous.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={uploadType === "pitch_deck" ? "default" : "outline"}
              size="sm"
              onClick={() => setUploadType("pitch_deck")}
            >
              Pitch Deck
            </Button>
            <Button
              variant={uploadType === "document" ? "default" : "outline"}
              size="sm"
              onClick={() => setUploadType("document")}
            >
              Document
            </Button>
          </div>
          <label
            className={cn(
              "block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              "border-border hover:border-primary/50",
            )}
          >
            <input
              type="file"
              accept=".pdf,.txt,.md,.html,.csv"
              multiple
              disabled={uploading}
              onChange={handleFileChange}
              className="hidden"
            />
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2 block" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2 block" />
            )}
            <p className="text-[13px] text-foreground">Click to upload</p>
            <p className="text-[12px] text-muted-foreground mt-1">PDF, TXT, MD, HTML, CSV</p>
          </label>
          {assets.length > 0 && (
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-muted-foreground">Saved assets</p>
              <div className="space-y-1">
                {assets.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-[13px]"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{a.title}</span>
                    <span className="text-[11px] text-muted-foreground capitalize">{a.type.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section E — Context Preview */}
      <Card className="border-border bg-card">
        <CardHeader>
          <button
            onClick={() => setShowContextPreview(!showContextPreview)}
            className="flex items-center justify-between w-full text-left"
          >
            <div>
              <CardTitle className="text-[15px] flex items-center gap-2">
                <Eye className="h-4 w-4" />
                What agents see
              </CardTitle>
              <CardDescription>Preview the context injected into every agent</CardDescription>
            </div>
            {showContextPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CardHeader>
        {showContextPreview && (
          <CardContent>
            <pre className="text-[12px] text-muted-foreground whitespace-pre-wrap bg-muted/30 p-4 rounded-lg max-h-[400px] overflow-y-auto font-sans">
              {contextPreview || "Loading..."}
            </pre>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

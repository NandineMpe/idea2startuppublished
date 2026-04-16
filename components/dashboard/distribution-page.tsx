"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
  Upload,
  Share2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { buildApolloPeopleSearchUrl } from "@/lib/apollo-search-url"
import {
  type DistributionMatch,
  type DistributionState,
  csvToMatches,
  fillTemplate,
  loadDistributionState,
  parseCsvRows,
  personalizeMatchesViaApi,
  saveDistributionState,
  similarSavedLeadPrimaryLine,
  similarSavedLeadSecondaryLine,
  summarizeConversionHistory,
  type TemplateVars,
} from "@/lib/distribution"
import { useToast } from "@/hooks/use-toast"
import { ContentCalendarPage } from "@/components/dashboard/content-calendar-page"
import { GtmMotionPanel } from "@/components/dashboard/gtm-motion-panel"
import { ReadersDigestPanel } from "@/components/dashboard/readers-digest-panel"
import { authClient } from "@/lib/better-auth-client"
import { loadGtmHubState, saveGtmHubState, type GtmHubState } from "@/lib/gtm-hub"

type AnalyseConversionResponse = {
  convertedLead: DistributionState["convertedLead"]
  lookalike: DistributionState["lookalike"]
  rationale: string
  searchQueries: DistributionState["searchQueries"]
  templates: DistributionState["templates"]
  pitchAngle: string
  segmentTag: string
  insightsHeadline: string
  similarExistingLeadsCount: number
  proactiveMessage: string
  lookalikeProfileId?: string | null
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  )
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function DistributionPage() {
  const { toast } = useToast()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const userId = session?.user?.id ?? null

  const [state, setState] = useState<DistributionState | null>(null)
  const [senderName, setSenderName] = useState("Founder")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [personalizing, setPersonalizing] = useState(false)
  const [form, setForm] = useState({
    name: "",
    title: "",
    company: "",
    location: "",
    whyItWorked: "",
    channel: "",
    responseTime: "",
  })

  const formHydrated = useRef(false)
  /** Top-level GTM facet (motion, reader's digest, content calendar). Lookalike hidden until LinkedIn is connected. */
  const [facetTab, setFacetTab] = useState("motion")
  const [mainTab, setMainTab] = useState("profile")
  const [gtmHub, setGtmHub] = useState<GtmHubState | null>(null)

  useEffect(() => {
    if (sessionPending) return
    setState(loadDistributionState(userId))
    setGtmHub(loadGtmHubState(userId))
    formHydrated.current = false
  }, [sessionPending, userId])

  useEffect(() => {
    if (!gtmHub || sessionPending) return
    saveGtmHubState(gtmHub, userId)
  }, [gtmHub, userId, sessionPending])

  useEffect(() => {
    if (!state || formHydrated.current) return
    formHydrated.current = true
    setForm({
      name: state.convertedLead.name,
      title: state.convertedLead.roleTitle,
      company: state.convertedLead.company,
      location: state.convertedLead.location ?? "",
      whyItWorked: "",
      channel: state.convertedLead.channel,
      responseTime: state.convertedLead.responseTime,
    })
  }, [state])

  useEffect(() => {
    fetch("/api/company/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { profile?: { founder_name?: string | null } | null }) => {
        const n = d.profile?.founder_name?.trim()
        if (n) setSenderName(n)
      })
      .catch(() => {})
  }, [])

  const persist = useCallback(
    (next: DistributionState) => {
      setState(next)
      saveDistributionState(next, userId)
    },
    [userId],
  )

  useEffect(() => {
    const onApollo = (e: Event) => {
      const detail = (e as CustomEvent<DistributionMatch[]>).detail
      if (!Array.isArray(detail) || detail.length === 0) return
      setState((prev) => {
        if (!prev) return prev
        const merged = { ...prev, matches: detail }
        saveDistributionState(merged, userId)
        return merged
      })
      toast({
        title: "Apollo import merged",
        description: `${detail.length} contacts with personalized outreach — review them on Matches.`,
      })
      setFacetTab("motion")
      setMainTab("matches")
    }
    window.addEventListener("junoDistributionApolloMatches", onApollo)
    return () => window.removeEventListener("junoDistributionApolloMatches", onApollo)
  }, [toast, userId])

  const matchesCount = state?.matches.length ?? 0

  function templateVarsFor(m: DistributionMatch): TemplateVars {
    return {
      name: [m.firstName, m.lastName].filter(Boolean).join(" "),
      firstName: m.firstName,
      title: m.title,
      company: m.company,
      location: m.location,
      sender_name: senderName,
    }
  }

  const handleImportCsv = (file: File | null) => {
    if (!file || !state) return
    const reader = new FileReader()
    reader.onload = () => {
      void (async () => {
        const text = String(reader.result || "")
        const rows = parseCsvRows(text)
        const matches = csvToMatches(rows)
        if (matches.length === 0) {
          toast({
            title: "No rows parsed",
            description: "Check that your CSV has headers (First name, Title, Company, …).",
            variant: "destructive",
          })
          return
        }
        if (!state.rationale.trim() || !state.pitchAngle.trim()) {
          toast({
            title: "Run the lookalike playbook first",
            description: "Use “Run lookalike playbook” on the Lookalike profile tab so Juno locks the winning angle.",
            variant: "destructive",
          })
          persist({ ...state, matches })
          return
        }

        const withMatches = { ...state, matches }
        persist(withMatches)
        toast({ title: "Imported", description: `${matches.length} leads loaded. Personalizing…` })
        setPersonalizing(true)
        try {
          const updated = await personalizeMatchesViaApi(matches, {
            rationale: withMatches.rationale,
            multiplierNote: withMatches.convertedLead.multiplierNote,
            pitchAngle: withMatches.pitchAngle,
            templates: withMatches.templates,
            lookalikeProfileId: withMatches.activeLookalikeProfileId,
          })
          persist({
            ...withMatches,
            matches: updated,
          })
          toast({
            title: "Outreach personalized",
            description: `Drafted messages for ${updated.filter((m) => m.personalizedInmail).length} leads.`,
          })
        } catch (e) {
          toast({
            title: "Personalization failed",
            description: e instanceof Error ? e.message : "Try again or check your session.",
            variant: "destructive",
          })
        } finally {
          setPersonalizing(false)
        }
      })()
    }
    reader.readAsText(file)
  }

  const runAnalyseConversion = async () => {
    if (!state) return
    const name = form.name.trim()
    const title = form.title.trim()
    const company = form.company.trim()
    if (!name || !title || !company) {
      toast({
        title: "Missing fields",
        description: "Add at least name, title, and company for the conversion.",
        variant: "destructive",
      })
      return
    }
    setAnalysing(true)
    try {
      const res = await fetch("/api/leads/analyse-conversion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          title,
          company,
          location: form.location.trim() || undefined,
          whyItWorked: form.whyItWorked.trim() || undefined,
          channel: form.channel.trim() || undefined,
          responseTime: form.responseTime.trim() || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as AnalyseConversionResponse & { error?: string }
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`)
      }
      const entry = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}`,
        segmentTag: data.segmentTag,
        name: data.convertedLead.name,
        company: data.convertedLead.company,
        at: new Date().toISOString(),
      }
      const similarRows = Array.isArray(data.similarExistingLeads)
        ? data.similarExistingLeads.map((r) => ({
            company: String(r.company ?? "").trim(),
            role: String(r.role ?? "").trim(),
            contactName: typeof r.contactName === "string" ? r.contactName.trim() || undefined : undefined,
          }))
        : []
      persist({
        ...state,
        activeLookalikeProfileId: data.lookalikeProfileId ?? state.activeLookalikeProfileId,
        convertedLead: data.convertedLead,
        lookalike: data.lookalike,
        rationale: data.rationale,
        searchQueries: data.searchQueries,
        templates: data.templates,
        pitchAngle: data.pitchAngle,
        segmentTag: data.segmentTag,
        insightsHeadline: data.insightsHeadline,
        proactiveMessage: data.proactiveMessage,
        similarLeadsCount: data.similarExistingLeadsCount,
        similarExistingLeads: similarRows.filter((r) => r.company && r.role),
        conversionHistory: [...state.conversionHistory, entry],
      })
      setForm((prev) => ({
        ...prev,
        name: data.convertedLead.name,
        title: data.convertedLead.roleTitle,
        company: data.convertedLead.company,
        location: data.convertedLead.location ?? "",
        channel: data.convertedLead.channel,
        responseTime: data.convertedLead.responseTime,
        whyItWorked: "",
      }))
      setMainTab("queries")
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" })
      })
      toast({
        title: "Lookalike profile ready",
        description: "Switched to Search queries — copy strings into Sales Navigator or Apollo, then export a CSV for Matches.",
      })
    } catch (e) {
      toast({
        title: "Analysis failed",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setAnalysing(false)
    }
  }

  const markSent = (id: string) => {
    if (!state) return
    const row = state.matches.find((m) => m.id === id)
    persist({
      ...state,
      matches: state.matches.map((m) => (m.id === id ? { ...m, sent: true } : m)),
    })
    toast({ title: "Marked as sent" })
    const pid = state.activeLookalikeProfileId
    if (pid && row) {
      void fetch(`/api/lookalike-profiles/${pid}/outcome`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "contacted",
          channel: state.convertedLead.channel,
          actualAttributes: {
            title: row.title,
            company: row.company,
            companyType: "",
            companySize: "",
            geography: row.location,
            industry: "",
          },
        }),
      }).catch(() => {})
    }
  }

  const updateTemplates = (patch: Partial<DistributionState["templates"]>) => {
    if (!state) return
    persist({
      ...state,
      templates: { ...state.templates, ...patch },
    })
  }

  const onCopy = async (label: string, text: string) => {
    const ok = await copyText(text)
    toast({
      title: ok ? "Copied" : "Copy failed",
      description: ok ? label : "Try selecting the text manually.",
      variant: ok ? "default" : "destructive",
    })
  }


  if (sessionPending || !state || gtmHub === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  const lead = state.convertedLead
  const L = state.lookalike
  const titles = L.targetTitles ?? []
  const companyTypes = L.companyTypes ?? []
  const geography = L.geography ?? []
  const companySize = L.companySize ?? []

  const apolloDeepLink =
    state.searchQueries.apolloAppUrl?.trim() ||
    buildApolloPeopleSearchUrl({
      targetTitles: titles,
      companyTypes,
      geography,
      companySize,
    })

  return (
    <div
      className={cn(
        "mx-auto space-y-6",
        facetTab === "content-calendar" ? "max-w-[1600px]" : "max-w-[900px]"
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-muted-foreground" />
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">GTM</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">GTM</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Your go-to-market workspace — lookalike targeting, outreach playbooks, and more facets as we ship them.
        </p>
      </div>

      <Tabs value={facetTab} onValueChange={setFacetTab} className="w-full">
        <TabsList className="mb-2 flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-border bg-muted/40 p-1">
          <TabsTrigger
            value="motion"
            className="rounded-md px-4 py-2 text-[13px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            GTM motion
          </TabsTrigger>
          <TabsTrigger
            value="readers-digest"
            className="rounded-md px-4 py-2 text-[13px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 opacity-70" />
              Reader's Digest
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="content-calendar"
            className="rounded-md px-4 py-2 text-[13px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 opacity-70" />
              Content calendar
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="motion" className="mt-4 focus-visible:outline-none">
          <GtmMotionPanel />
        </TabsContent>

        <TabsContent value="readers-digest" className="mt-4 focus-visible:outline-none">
          <ReadersDigestPanel />
        </TabsContent>

        <TabsContent value="content-calendar" className="mt-4 focus-visible:outline-none">
          <ContentCalendarPage embedded />
        </TabsContent>

        <TabsContent value="lookalike" className="mt-4 space-y-6 focus-visible:outline-none">
        {state.activeLookalikeProfileId ? (
          <p className="text-[12px] text-emerald-800 dark:text-emerald-400/95">
            Playbook saved server-side — weighted ICP, search queries, and outreach feedback refine this profile.
          </p>
        ) : null}

        <p className="max-w-2xl text-sm text-muted-foreground">
          Log one conversion — Juno infers why it worked, builds lookalike criteria and queries, then personalizes every
          Sales Navigator row against that playbook.
        </p>

      {(state.insightsHeadline ||
        state.proactiveMessage ||
        state.conversionHistory.length > 0 ||
        typeof state.similarLeadsCount === "number" ||
        (state.similarExistingLeads?.length ?? 0) > 0) && (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/95 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-200">
            Conversion insights
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {state.insightsHeadline || summarizeConversionHistory(state.conversionHistory)}
          </p>
          {state.proactiveMessage ? (
            <p className="mt-2 text-[13px] text-muted-foreground">{state.proactiveMessage}</p>
          ) : null}
          {typeof state.similarLeadsCount === "number" && state.similarLeadsCount > 0 ? (
            <p className="mt-2 text-[12px] font-medium text-amber-900 dark:text-amber-300/95">
              {state.similarLeadsCount} similar profile{state.similarLeadsCount === 1 ? "" : "s"} in your saved Juno
              leads
            </p>
          ) : null}
          {(state.similarExistingLeads?.length ?? 0) > 0 ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-200">
                Lookalikes in your Juno saves
              </p>
              <p className="mb-2 mt-1 text-[11px] text-amber-950/75 dark:text-amber-200/70">
                Contact names appear when stored on the lead; otherwise we show role and company from your saved list.
              </p>
              <ul className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-amber-200/70 bg-white/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                {state.similarExistingLeads.map((row, idx) => (
                  <li key={`${row.company}-${row.role}-${idx}`} className="text-[13px] leading-snug">
                    <span className="font-medium text-foreground">{similarSavedLeadPrimaryLine(row)}</span>
                    {similarSavedLeadSecondaryLine(row) ? (
                      <span className="block text-[12px] text-muted-foreground">
                        {similarSavedLeadSecondaryLine(row)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-3 border-t border-amber-200/80 pt-3 text-[11px] leading-relaxed text-amber-950/80 dark:text-amber-200/80">
            The <span className="font-medium text-foreground">Matches</span> tab only lists people from{" "}
            <span className="font-medium text-foreground">CSV imports</span> (Sales Navigator export). Similar leads
            already in Juno stay in your saved lead list — they are not auto-added to Matches.
          </p>
        </div>
      )}

      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="mb-1 flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger
            value="profile"
            className="rounded-none border-b-2 border-transparent px-3 py-2 text-[13px] data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Lookalike profile
          </TabsTrigger>
          <TabsTrigger
            value="queries"
            className="rounded-none border-b-2 border-transparent px-3 py-2 text-[13px] data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Search queries
          </TabsTrigger>
          <TabsTrigger
            value="matches"
            className="rounded-none border-b-2 border-transparent px-3 py-2 text-[13px] data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Matches ({matchesCount})
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="rounded-none border-b-2 border-transparent px-3 py-2 text-[13px] data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Outreach templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <div id="lookalike-profile-output" className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              This is your current lookalike playbook (updates each time you run it). Scroll down to log another
              conversion.
            </p>
          <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/[0.06] p-5 dark:border-emerald-500/30 dark:bg-emerald-950/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    Converted
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-foreground">{lead.name}</h2>
                <p className="text-[13px] text-muted-foreground">
                  {lead.roleTitle} at {lead.company}
                  {lead.location ? `, ${lead.location}` : ""}
                </p>
              </div>
              <div className="text-right text-[12px] text-muted-foreground sm:min-w-[160px]">
                <p>
                  <span className="text-foreground/80">Channel:</span> {lead.channel}
                </p>
                <p>
                  <span className="text-foreground/80">Response:</span> {lead.responseTime}
                </p>
              </div>
            </div>
            <p className="mt-4 border-t border-emerald-500/20 pt-3 text-[12px] font-medium text-emerald-900 dark:text-emerald-100/90">
              {lead.multiplierNote}
            </p>
          </div>

          <p className="text-[13px] text-muted-foreground">
            Criteria below are derived from the conversion with {lead.name}. Use them to search for similar contacts.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Target titles
              </p>
              <div className="flex flex-wrap gap-1.5">
                {titles.map((t) => (
                  <Pill key={t} className="bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
                    {t}
                  </Pill>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Company types
              </p>
              <div className="flex flex-wrap gap-1.5">
                {companyTypes.map((t) => (
                  <Pill key={t} className="bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
                    {t}
                  </Pill>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Geography
              </p>
              <div className="flex flex-wrap gap-1.5">
                {geography.map((t) => (
                  <Pill key={t} className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
                    {t}
                  </Pill>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Company size
              </p>
              <div className="flex flex-wrap gap-1.5">
                {companySize.map((t) => (
                  <Pill key={t} className="bg-muted text-muted-foreground">
                    {t}
                  </Pill>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-4 dark:border-violet-900/50 dark:bg-violet-950/30">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">
              Why this profile works
            </p>
            <p className="text-[13px] leading-relaxed text-violet-950 dark:text-violet-100/90">{state.rationale}</p>
          </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-sm font-medium text-foreground">Log or update a conversion</p>
            <p className="mb-3 text-[13px] text-muted-foreground">
              Mark who converted — only the basics. Optional: tell Juno why it worked and which channel so the model can
              reason about the playbook.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="conv-name">Full name</Label>
                <Input
                  id="conv-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conv-title">Title / function</Label>
                <Input
                  id="conv-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Title or function"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conv-company">Company</Label>
                <Input
                  id="conv-company"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conv-loc">Location (optional)</Label>
                <Input
                  id="conv-loc"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="City or region"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conv-channel">Channel (optional)</Label>
                <Input
                  id="conv-channel"
                  value={form.channel}
                  onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                  placeholder="LinkedIn InMail"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conv-response">Response time (optional)</Label>
                <Input
                  id="conv-response"
                  value={form.responseTime}
                  onChange={(e) => setForm((f) => ({ ...f, responseTime: e.target.value }))}
                  placeholder="Same day"
                />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="conv-why">Why do you think it worked? (optional)</Label>
              <Textarea
                id="conv-why"
                value={form.whyItWorked}
                onChange={(e) => setForm((f) => ({ ...f, whyItWorked: e.target.value }))}
                rows={3}
                placeholder="They trusted the Big Four angle; partner-level multiplier across clients…"
                className="text-[13px]"
              />
            </div>
            <Button
              type="button"
              className="mt-4"
              onClick={() => void runAnalyseConversion()}
              disabled={analysing}
            >
              {analysing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analysing…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Run lookalike playbook
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="queries" className="mt-4 space-y-5">
          <p className="text-[13px] text-muted-foreground">
            Copy a query, switch to Sales Navigator or Apollo, paste, and export when you&apos;re happy with the list.
          </p>

          <div className="rounded-xl border border-indigo-200/90 bg-indigo-50/90 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/35">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-950 dark:text-indigo-200">
              Apollo (free tier — no API)
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground">
              Opens Apollo with your lookalike <span className="font-medium">titles</span> and{" "}
              <span className="font-medium">locations</span> pre-filled. Run the search, then use the{" "}
              <span className="font-medium">Juno Lead Pipe</span> extension on the results page (or click{" "}
              <span className="font-medium">Scan Apollo results</span> in the popup). Come back to this tab — your
              playbook syncs automatically and matches merge into <span className="font-medium">Matches</span>.
            </p>
            <Button
              type="button"
              className="mt-3 bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              onClick={() => {
                window.open(apolloDeepLink, "_blank", "noopener,noreferrer")
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Find lookalikes on Apollo
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              If filters look empty in Apollo, refine them manually — URL params can change when Apollo updates their
              app.
            </p>
          </div>

          {[
            { label: "LinkedIn Sales Navigator", body: state.searchQueries.linkedinSalesNav },
            { label: "Apollo", body: state.searchQueries.apollo },
            { label: "LinkedIn boolean (basic search)", body: state.searchQueries.linkedinBoolean },
          ].map((q) => (
            <div key={q.label} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{q.label}</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => void onCopy(q.label, q.body)}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy query
                </Button>
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-[12px] leading-relaxed text-foreground">
                {q.body}
              </pre>
            </div>
          ))}

          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="mb-1 text-sm font-medium">Import CSV into Juno</p>
            <p className="mb-4 text-[12px] text-muted-foreground">
              Export your search results, then upload the CSV here — Juno personalises copy for each row for you to review and send.
            </p>
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleImportCsv(e.target.files?.[0] ?? null)}
              />
              <span className="inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
                Choose CSV file
              </span>
            </label>
          </div>
        </TabsContent>

        <TabsContent value="matches" className="mt-4 space-y-3">
          {matchesCount === 0 ? (
            <div className="rounded-xl border border-border bg-muted/20 py-16 text-center text-sm text-muted-foreground">
              No matches yet. Use <span className="font-medium text-foreground">Apollo + Juno extension</span> from
              Search queries, or export CSV from Sales Navigator and import on that tab. Refresh this page if you
              scraped Apollo in another tab.
            </div>
          ) : (
            <div className="space-y-3">
              {state.matches.map((m) => {
                const vars = templateVarsFor(m)
                const inmail = m.personalizedInmail ?? fillTemplate(state.templates.inmail, vars)
                const email = m.personalizedEmail ?? fillTemplate(state.templates.coldEmail, vars)
                const open = expandedId === m.id
                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-border bg-card text-card-foreground shadow-sm"
                  >
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 p-4 text-left"
                      onClick={() => setExpandedId(open ? null : m.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold tracking-tight text-foreground">
                          {[m.firstName, m.lastName].filter(Boolean).join(" ") || "—"}
                        </p>
                        <p className="text-[12px] text-muted-foreground">{m.title}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {m.company}
                          {m.location ? ` · ${m.location}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                          {m.fitScore}%
                        </span>
                        {m.sent && (
                          <span className="flex items-center gap-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Sent
                          </span>
                        )}
                        {open ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    {open && (
                      <div className="space-y-3 border-t border-border bg-muted/30 px-4 py-4">
                        <div>
                          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Personalised InMail
                          </p>
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-[12px] leading-relaxed">
                            {inmail}
                          </pre>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mt-2"
                            onClick={() => void onCopy("InMail", inmail)}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Copy InMail
                          </Button>
                        </div>
                        <div>
                          <p className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            <span>Cold email</span>
                            {m.personalizedEmail ? (
                              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold normal-case text-violet-700 dark:text-violet-300">
                                AI
                              </span>
                            ) : null}
                          </p>
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-[12px] leading-relaxed">
                            {email}
                          </pre>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mt-2"
                            onClick={() => void onCopy("Email", email)}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Copy email
                          </Button>
                        </div>
                        {!m.sent && (
                          <Button type="button" size="sm" onClick={() => markSent(m.id)}>
                            Mark as sent
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4 space-y-4">
          <p className="text-[13px] text-muted-foreground">
            Variables:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[12px]">
              {"{name}"} {"{firstName}"} {"{title}"} {"{function}"} {"{company}"} {"{location}"} {"{sender_name}"}
            </code>
            . Juno uses these when drafting the playbook; CSV import fills in fully personalized copy per row for you to review.
          </p>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              InMail template
            </label>
            <Textarea
              value={state.templates.inmail}
              onChange={(e) => updateTemplates({ inmail: e.target.value })}
              rows={10}
              className="font-mono text-[12px] leading-relaxed"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Cold email template
            </label>
            <Textarea
              value={state.templates.coldEmail}
              onChange={(e) => updateTemplates({ coldEmail: e.target.value })}
              rows={12}
              className="font-mono text-[12px] leading-relaxed"
            />
          </div>
        </TabsContent>
      </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}

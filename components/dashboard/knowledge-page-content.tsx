"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  BookOpen,
  MessageSquare,
  TrendingUp,
  Loader2,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { GithubVaultSettings } from "@/components/dashboard/github-vault-settings"

type MemoryHit = { content?: string }

const hubLinks = [
  {
    title: "Domain documents",
    description: "Industry reports, research, and decks saved as company assets and semantic memory.",
    href: "/dashboard/knowledge/domain",
    icon: BookOpen,
  },
  {
    title: "Feedback & insights",
    description: "Capture customer and stakeholder feedback for analysis.",
    href: "/dashboard/knowledge/feedback",
    icon: MessageSquare,
  },
  {
    title: "Founder's journey",
    description: "Narrative and milestones that shape positioning.",
    href: "/dashboard/knowledge/founders-journey",
    icon: TrendingUp,
  },
] as const

export function KnowledgePageContent() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [inputContent, setInputContent] = useState("")
  const [memories, setMemories] = useState<MemoryHit[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [contextPreview, setContextPreview] = useState("")
  const [showContext, setShowContext] = useState(false)
  const [assetCount, setAssetCount] = useState<number | null>(null)

  const loadContext = useCallback(async () => {
    try {
      const res = await fetch("/api/company/context")
      const data = await res.json()
      setContextPreview(data.context ?? "")
    } catch {
      setContextPreview("Could not load context.")
    }
  }, [])

  const loadAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/company/assets")
      const data = await res.json()
      setAssetCount(Array.isArray(data.assets) ? data.assets.length : 0)
    } catch {
      setAssetCount(null)
    }
  }, [])

  const handleSearch = async () => {
    setIsSearching(true)
    try {
      const q = encodeURIComponent(searchQuery || "company startup")
      const res = await fetch(`/api/knowledge?q=${q}`)
      const data = await res.json()
      const raw = data.results
      const list = Array.isArray(raw) ? raw : raw?.results ?? []
      setMemories(Array.isArray(list) ? list : [])
    } catch {
      setMemories([])
      toast({ title: "Search failed", variant: "destructive" })
    } finally {
      setIsSearching(false)
    }
  }

  const handleAdd = async () => {
    if (!inputContent.trim()) return
    setIsAdding(true)
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputContent.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Failed")
      }
      toast({ title: "Saved to knowledge base", description: "Agents can use this in context." })
      setInputContent("")
      handleSearch()
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "Try again", variant: "destructive" })
    } finally {
      setIsAdding(false)
    }
  }

  useEffect(() => {
    void loadAssets()
    void (async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/knowledge?q=${encodeURIComponent("company startup")}`)
        const data = await res.json()
        const raw = data.results
        const list = Array.isArray(raw) ? raw : raw?.results ?? []
        setMemories(Array.isArray(list) ? list : [])
      } finally {
        setIsSearching(false)
      }
    })()
  }, [loadAssets])

  return (
    <div className="flex flex-col gap-6">
      <GithubVaultSettings />

      {assetCount !== null && (
        <p className="text-[13px] text-muted-foreground">
          {assetCount} saved document{assetCount === 1 ? "" : "s"} / assets on file. Add more from the{" "}
          <button onClick={() => {}} className="text-primary hover:underline">Company &amp; Founder</button> tab or Domain documents below.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {hubLinks.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="group block">
              <Card className="h-full border-border bg-card hover:border-primary/40 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px] flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    {item.title}
                  </CardTitle>
                  <CardDescription className="text-[13px] leading-relaxed">{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <button
            type="button"
            onClick={() => {
              setShowContext((v) => {
                const next = !v
                if (next) loadContext()
                return next
              })
            }}
            className="flex w-full items-center justify-between text-left gap-2"
          >
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-[15px]">What agents see (assembled context)</CardTitle>
            </div>
            {showContext ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </button>
          <CardDescription>Profile, documents, scraped pages, and semantic memory merged for chat and tools.</CardDescription>
        </CardHeader>
        {showContext && (
          <CardContent>
            <pre className="text-[12px] text-muted-foreground whitespace-pre-wrap bg-muted/40 p-4 rounded-lg max-h-[320px] overflow-y-auto font-sans border border-border">
              {contextPreview || <Loader2 className="h-4 w-4 animate-spin inline" />}
            </pre>
            <Button variant="outline" size="sm" className="mt-3" onClick={loadContext}>
              Refresh preview
            </Button>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-[15px]">Quick capture</CardTitle>
            <CardDescription>Short note or insight — stored in your knowledge base for retrieval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="e.g. Competitor launched feature X…"
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="bg-background"
            />
            <Button onClick={handleAdd} disabled={isAdding || !inputContent.trim()} className="gap-2">
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save to knowledge base
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-[15px]">Search memories</CardTitle>
            <CardDescription>Semantic search over saved snippets (same pool agents query).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 bg-background"
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button variant="secondary" onClick={handleSearch} disabled={isSearching}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {memories.length === 0 && !isSearching && (
                <p className="text-[13px] text-muted-foreground">No results yet — add content or broaden your search.</p>
              )}
              {memories.map((m, i) => (
                <div
                  key={i}
                  className={cn("text-[13px] text-foreground/90 p-3 rounded-md border border-border bg-muted/20", "line-clamp-4")}
                >
                  {typeof m.content === "string" ? m.content : JSON.stringify(m)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-[12px] text-muted-foreground flex items-center gap-2">
        <FileText className="h-3.5 w-3.5" />
        Large files: upload on the Company &amp; Founder tab or Domain documents — text is extracted and included in agent context.
      </p>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react"
import { GithubVaultSettings } from "@/components/dashboard/github-vault-settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type KnowledgeHit = {
  content?: string
  excerpt?: string
  path?: string
  title?: string
}

const hubLinks = [
  {
    title: "Domain documents",
    description: "Industry reports, research, and decks stored in your document library and mirrored into the vault.",
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
  const [results, setResults] = useState<KnowledgeHit[]>([])
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

  const runSearch = useCallback(
    async (query: string) => {
      setIsSearching(true)
      try {
        const q = encodeURIComponent(query || "company startup")
        const res = await fetch(`/api/knowledge?q=${q}`)
        const data = await res.json()
        const raw = data.results
        const list = Array.isArray(raw) ? raw : raw?.results ?? []
        setResults(Array.isArray(list) ? list : [])
      } catch {
        setResults([])
        toast({ title: "Search failed", variant: "destructive" })
      } finally {
        setIsSearching(false)
      }
    },
    [toast],
  )

  const handleAdd = async () => {
    if (!inputContent.trim()) return
    setIsAdding(true)
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputContent.trim(), title: "Quick capture" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Failed")
      }
      toast({ title: "Saved to vault", description: "Agents will pull this from your Obsidian knowledge layer." })
      setInputContent("")
      void runSearch(searchQuery || "company startup")
    } catch (error) {
      toast({
        title: "Could not save",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
  }

  useEffect(() => {
    void loadAssets()
    void runSearch("company startup")
  }, [loadAssets, runSearch])

  return (
    <div className="flex flex-col gap-6">
      <GithubVaultSettings />

      {assetCount !== null && (
        <p className="text-[13px] text-muted-foreground">
          {assetCount} saved document{assetCount === 1 ? "" : "s"} / assets on file. New uploads are synced into the vault before agents use them.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {hubLinks.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="group block">
              <Card className="h-full border-border bg-card transition-colors hover:border-primary/40">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-[15px]">
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
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
              setShowContext((value) => {
                const next = !value
                if (next) void loadContext()
                return next
              })
            }}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-[15px]">What agents see (assembled context)</CardTitle>
            </div>
            {showContext ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </button>
          <CardDescription>Profile plus the connected Obsidian vault, merged for chat and tools.</CardDescription>
        </CardHeader>
        {showContext && (
          <CardContent>
            <pre className="max-h-[320px] overflow-y-auto rounded-lg border border-border bg-muted/40 p-4 font-sans text-[12px] whitespace-pre-wrap text-muted-foreground">
              {contextPreview || <Loader2 className="inline h-4 w-4 animate-spin" />}
            </pre>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadContext()}>
              Refresh preview
            </Button>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-[15px]">Quick capture</CardTitle>
            <CardDescription>Short note or insight saved directly into the vault-backed knowledge base.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="e.g. Competitor launched feature X..."
              value={inputContent}
              onChange={(event) => setInputContent(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleAdd()}
              className="bg-background"
            />
            <Button onClick={handleAdd} disabled={isAdding || !inputContent.trim()} className="gap-2">
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save to vault
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-[15px]">Search vault notes</CardTitle>
            <CardDescription>Find the same Obsidian-backed notes and documents the agents search.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="bg-background pl-9"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void runSearch(searchQuery)}
                />
              </div>
              <Button variant="secondary" onClick={() => void runSearch(searchQuery)} disabled={isSearching}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
            <div className="max-h-[220px] space-y-2 overflow-y-auto">
              {results.length === 0 && !isSearching && (
                <p className="text-[13px] text-muted-foreground">No results yet - add content or broaden your search.</p>
              )}
              {results.map((result, index) => (
                <div
                  key={`${result.path || "result"}-${index}`}
                  className={cn(
                    "rounded-md border border-border bg-muted/20 p-3 text-[13px] text-foreground/90",
                    "space-y-1",
                  )}
                >
                  {result.path && <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{result.path}</p>}
                  <p className="line-clamp-4">{result.excerpt || result.content || JSON.stringify(result)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        Large files still upload through the document flows, but agents ground on the vault copy after sync.
      </p>
    </div>
  )
}

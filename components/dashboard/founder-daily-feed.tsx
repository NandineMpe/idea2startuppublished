"use client"

import { useCallback } from "react"
import {
  Zap,
  Bot,
  FileText,
  Target,
  Banknote,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"

/** Wireframe item — replace with API-backed feed later */
export type FeedItemWireframe = {
  id: string
  headline: string
  source: string
  timeLabel: string
  url: string
  relevance?: string
}

const SECTIONS: {
  key: "breaking" | "ai_tools" | "research" | "competitors" | "funding"
  label: string
  icon: typeof Zap
  description: string
  placeholderItems: FeedItemWireframe[]
}[] = [
  {
    key: "breaking",
    label: "Breaking",
    icon: Zap,
    description: "Time-sensitive news that may affect your market or stack.",
    placeholderItems: [
      {
        id: "1",
        headline: "EU AI Act: new compliance deadlines clarified for high-risk systems",
        source: "Reuters",
        timeLabel: "Today",
        url: "https://example.com",
        relevance: "Relevant if you sell into regulated AI use cases.",
      },
    ],
  },
  {
    key: "ai_tools",
    label: "AI & tools",
    icon: Bot,
    description: "Model and product releases mapped to your space (e.g. finance, compliance).",
    placeholderItems: [
      {
        id: "2",
        headline: "Anthropic expands Excel integration for enterprise workflows",
        source: "TechCrunch",
        timeLabel: "Yesterday",
        url: "https://example.com",
        relevance: "Example: matters for AI compliance & document-heavy teams.",
      },
      {
        id: "3",
        headline: "ChatGPT adds deeper spreadsheet and finance shortcuts",
        source: "OpenAI Blog",
        timeLabel: "Mar 15",
        url: "https://example.com",
      },
    ],
  },
  {
    key: "research",
    label: "Research",
    icon: FileText,
    description: "Papers, benchmarks, datasets (e.g. arXiv, journals).",
    placeholderItems: [
      {
        id: "4",
        headline: "New finance-domain LLM benchmark suite released",
        source: "arXiv",
        timeLabel: "Mar 14",
        url: "https://arxiv.org",
        relevance: "Useful for positioning vs. general-purpose models.",
      },
    ],
  },
  {
    key: "competitors",
    label: "Competitors",
    icon: Target,
    description: "Product launches, partnerships, and major moves.",
    placeholderItems: [],
  },
  {
    key: "funding",
    label: "Funding",
    icon: Banknote,
    description: "Competitor and adjacent rounds to watch.",
    placeholderItems: [],
  },
]

function FeedRow({
  item,
}: {
  item: FeedItemWireframe
}) {
  const open = useCallback(() => {
    if (item.url) window.open(item.url, "_blank", "noopener,noreferrer")
  }, [item.url])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter") open()
      }}
      className={cn(
        "group rounded-md border border-border/80 bg-background px-3 py-2.5 -mx-1",
        "hover:bg-muted/80 hover:border-primary/30 cursor-pointer select-none",
        "transition-colors",
      )}
      title="Click to open in a new tab"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground leading-snug">{item.headline}</p>
          {item.relevance && (
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{item.relevance}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5">
            <span className="text-[11px] font-medium text-primary/90">{item.source}</span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground">{item.timeLabel}</span>
          </div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  )
}

type FounderDailyFeedProps = {
  /** e.g. sidebar layout: sticky + max height */
  className?: string
}

export function FounderDailyFeed({ className }: FounderDailyFeedProps) {
  return (
    <section
      className={cn(
        "rounded-lg border-2 border-primary/25 bg-card text-foreground shadow-sm flex flex-col",
        "min-h-[280px] max-h-[min(80vh,880px)] lg:max-h-[calc(100vh-7rem)] overflow-hidden",
        className,
      )}
    >
      <div className="px-4 py-3 border-b border-border bg-primary/5 shrink-0">
        <h2 className="text-base font-semibold text-foreground">Signal feed</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Preview layout · Live items will mirror your scored daily brief (CBS pipeline)
        </p>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto min-h-0 flex-1 bg-card">
        {SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <div key={section.key}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.label}
                  {section.placeholderItems.length > 0 && (
                    <span className="font-normal normal-case ml-1.5 text-[11px]">
                      · {section.placeholderItems.length}
                    </span>
                  )}
                </h3>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">{section.description}</p>

              {section.placeholderItems.length === 0 ? (
                <p className="text-[12px] text-muted-foreground/80 italic py-2 px-1 border border-dashed border-border rounded-md bg-muted/20">
                  Nothing new in this category today — placeholder until the feed is connected.
                </p>
              ) : (
                <div className="space-y-1 divide-y divide-border/60">
                  {section.placeholderItems.map((item) => (
                    <FeedRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

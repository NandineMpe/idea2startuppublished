import type { CompetitorTrackingRow, FundingTrackerRow } from "@/lib/juno/competitor-persistence"
import type { ScoredItem } from "@/lib/juno/scoring"

/** Loaded before formatting so the brief can show persistent competitor + funding context. */
export type PersistentBriefContext = {
  recentCompetitorEvents: CompetitorTrackingRow[]
  recentFunding: FundingTrackerRow[]
}

/** Dashboard sections aligned with Signal feed UI (`founder-daily-feed.tsx`). */
export interface DashboardBrief {
  date: string
  generatedAt: string
  breaking: ScoredItem[]
  ai_tools: ScoredItem[]
  research: ScoredItem[]
  competitors: ScoredItem[]
  funding: ScoredItem[]
  totalScraped: number
  totalAfterScoring: number
}

export interface FormattedBrief {
  /** Human-readable date (e.g. en-IE locale) */
  date: string
  /** YYYY-MM-DD for DB + APIs */
  briefDateIso: string
  /** Full markdown for DB + Signal feed (in-app) */
  email: string
  dashboard: DashboardBrief
}

/** API / dashboard JSON shape for one scored item (three intelligence layers). */
export function formatDashboardItem(item: ScoredItem): Record<string, unknown> {
  const base: Record<string, unknown> = {
    title: item.title,
    source: item.source,
    url: item.url,
    score: item.relevanceScore,
    urgency: item.urgency,
    category: item.category,
    whyItMatters: item.whyItMatters,
    strategicImplication: item.strategicImplication,
    suggestedAction: item.suggestedAction,
    connectionToRoadmap: item.connectionToRoadmap,
  }
  if (item.competitorEvent) base.competitorEvent = item.competitorEvent
  return base
}

function bucketItemsForDashboard(items: ScoredItem[]): Omit<DashboardBrief, "date" | "generatedAt" | "totalScraped" | "totalAfterScoring"> {
  const breaking: ScoredItem[] = []
  const competitors: ScoredItem[] = []
  const funding: ScoredItem[] = []
  const research: ScoredItem[] = []
  const ai_tools: ScoredItem[] = []

  const seen = new Set<string>()

  for (const item of items) {
    const key = `${item.url}\0${item.title}`
    if (seen.has(key)) continue
    seen.add(key)

    if (item.urgency === "breaking") {
      breaking.push(item)
      continue
    }

    switch (item.category) {
      case "competitor":
        competitors.push(item)
        break
      case "funding":
        funding.push(item)
        break
      case "research":
        research.push(item)
        break
      case "tool":
      case "regulation":
      case "opportunity":
      default:
        ai_tools.push(item)
        break
    }
  }

  return { breaking, ai_tools, research, competitors, funding }
}

function daysAgoFromIso(iso: string | undefined): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000))
}

function sumFundingMillions(rows: FundingTrackerRow[]): number {
  let sum = 0
  for (const f of rows) {
    const raw = f.amount
    if (!raw) continue
    const s = raw.toLowerCase()
    const num = parseFloat(raw.replace(/[^0-9.]/g, ""))
    if (Number.isNaN(num)) continue
    const mult = s.includes("b") ? 1000 : s.includes("m") ? 1 : 0.001
    sum += num * mult
  }
  return sum
}

function appendPersistentSections(
  md: string,
  persistent: PersistentBriefContext | null | undefined,
  briefDateIso: string,
): string {
  if (!persistent) return md
  const { recentCompetitorEvents, recentFunding } = persistent
  let out = md

  if (recentCompetitorEvents.length > 0) {
    const todayPrefix = briefDateIso
    const todayEvents = recentCompetitorEvents.filter((e) => e.discovered_at?.startsWith(todayPrefix))
    if (todayEvents.length === 0) {
      out += `\n## Competitor landscape (last 30 days)\n\n`
      out += `No new competitor moves today in tracked events. Recent activity:\n\n`
      for (const event of recentCompetitorEvents.slice(0, 5)) {
        const d = daysAgoFromIso(event.discovered_at)
        const threat = event.threat_level ? ` — Threat: ${event.threat_level}` : ""
        out += `- **${event.competitor_name}**: ${event.title} (${d}d ago)${threat}\n`
      }
      out += `\n`
    }
  }

  if (recentFunding.length > 0) {
    const total = sumFundingMillions(recentFunding)
    out += `\n## Funding in your space (last 90 days)\n\n`
    out += `${recentFunding.length} round(s) tracked — roughly **$${Math.round(total)}M** implied from disclosed amounts.\n\n`
    for (const round of recentFunding.slice(0, 5)) {
      const tag = round.is_competitor ? "⚠️ competitor" : "📊"
      const rt = round.round_type ? ` ${round.round_type}` : ""
      const lead = round.lead_investor || "undisclosed"
      out += `- ${tag} **${round.company_name}**: ${round.amount ?? "—"}${rt} (${lead})\n`
    }
    out += `\n`
  }

  return out
}

export function formatBrief(
  items: ScoredItem[],
  totalScraped: number,
  persistent?: PersistentBriefContext | null,
): FormattedBrief {
  const now = new Date()
  const dateStr = now.toLocaleDateString("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const briefDateIso = now.toISOString().slice(0, 10)

  const buckets = bucketItemsForDashboard(items)

  const emailCore = formatEmail(items, dateStr)
  const email = appendPersistentSections(emailCore, persistent, briefDateIso)

  return {
    date: dateStr,
    briefDateIso,
    email,
    dashboard: {
      date: dateStr,
      generatedAt: now.toISOString(),
      ...buckets,
      totalScraped,
      totalAfterScoring: items.length,
    },
  }
}

function formatEmail(items: ScoredItem[], date: string): string {
  if (items.length === 0) {
    return `# Juno Daily Brief — ${date}\n\nQuiet day. Nothing critical in your space.`
  }

  let md = `# Juno Daily Brief — ${date}\n\n`
  md += `**${items.length} items** from ${new Set(items.map((i) => i.source)).size} sources\n\n`

  const groups: Record<string, ScoredItem[]> = {}
  for (const item of items) {
    const key =
      item.urgency === "breaking"
        ? "🔴 Breaking"
        : item.category === "competitor"
          ? "⚔️ Competitor moves"
          : item.category === "funding"
            ? "💰 Funding"
            : item.category === "regulation"
              ? "📋 Regulation"
              : item.category === "research"
                ? "📄 Research"
                : item.category === "tool"
                  ? "🛠️ Tools"
                  : "💡 Opportunities"

    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }

  for (const [section, sectionItems] of Object.entries(groups)) {
    md += `## ${section}\n\n`
    for (const item of sectionItems) {
      md += `### ${item.title}\n`
      md += `*${item.source}* · Score: ${item.relevanceScore}/10 · ${item.urgency}\n\n`
      md += `**Why this matters:** ${item.whyItMatters}\n\n`
      md += `**Strategic implication:** ${item.strategicImplication}\n\n`
      md += `**Suggested action:** ${item.suggestedAction}\n\n`
      if (item.connectionToRoadmap) {
        md += `**Roadmap connection:** ${item.connectionToRoadmap}\n\n`
      }
      md += `[Read more](${item.url})\n\n---\n\n`
    }
  }

  return md
}

/** Obsidian vault markdown: full strategic depth, grouped by urgency/category. */
export function formatBriefForVault(
  items: ScoredItem[],
  date: string,
  options?: { sourcesScraped?: number },
): string {
  let md = `---\ndate: ${date}\ntype: daily-brief\nitems: ${items.length}\n`
  if (options?.sourcesScraped != null) {
    md += `sources: ${options.sourcesScraped}\n`
  }
  md += `---\n\n`
  md += `# Daily Brief — ${date}\n\n`

  const grouped: Record<string, ScoredItem[]> = {}
  for (const item of items) {
    const key =
      item.urgency === "breaking"
        ? "🔴 Breaking"
        : item.category === "competitor"
          ? "⚔️ Competitor moves"
          : item.category === "funding"
            ? "💰 Funding"
            : item.category === "regulation"
              ? "📋 Regulation"
              : item.category === "research"
                ? "📄 Research"
                : item.category === "tool"
                  ? "🛠️ Tools"
                  : "💡 Opportunities"
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  }

  for (const [section, sectionItems] of Object.entries(grouped)) {
    md += `## ${section}\n\n`
    for (const item of sectionItems) {
      md += `### ${item.title}\n`
      md += `*${item.source}* · Score: ${item.relevanceScore}/10 · ${item.urgency}\n\n`
      md += `**Why this matters:** ${item.whyItMatters}\n\n`
      md += `**Strategic implication:** ${item.strategicImplication}\n\n`
      md += `**Suggested action:** ${item.suggestedAction}\n\n`
      if (item.connectionToRoadmap) {
        md += `**Roadmap connection:** ${item.connectionToRoadmap}\n\n`
      }
      md += `[Read more](${item.url})\n\n---\n\n`
    }
  }

  return md
}

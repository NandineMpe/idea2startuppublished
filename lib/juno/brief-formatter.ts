import type { ScoredItem } from "@/lib/juno/scoring"
import { formatBriefForWhatsApp } from "@/lib/juno/brief-format"

export interface DashboardBrief {
  date: string
  generatedAt: string
  breaking: ScoredItem[]
  watch: ScoredItem[]
  research: ScoredItem[]
  opportunity: ScoredItem[]
  totalScraped: number
  totalAfterScoring: number
}

export interface FormattedBrief {
  /** Human-readable date (e.g. en-IE locale) */
  date: string
  /** YYYY-MM-DD for DB + APIs */
  briefDateIso: string
  whatsapp: string
  email: string
  dashboard: DashboardBrief
}

export function formatBrief(items: ScoredItem[], totalScraped: number): FormattedBrief {
  const now = new Date()
  const dateStr = now.toLocaleDateString("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const briefDateIso = now.toISOString().slice(0, 10)

  const breaking = items.filter((i) => i.urgency === "breaking")
  const watch = items.filter((i) => i.urgency === "today" && i.relevanceScore >= 6)
  const research = items.filter((i) => i.category === "research")
  const opportunity = items.filter((i) => i.category === "opportunity")

  const whatsappRaw = formatWhatsApp(items, dateStr)
  const whatsapp = formatBriefForWhatsApp(whatsappRaw)

  return {
    date: dateStr,
    briefDateIso,
    whatsapp,
    email: formatEmail(items, dateStr),
    dashboard: {
      date: dateStr,
      generatedAt: now.toISOString(),
      breaking,
      watch,
      research,
      opportunity,
      totalScraped,
      totalAfterScoring: items.length,
    },
  }
}

function formatWhatsApp(items: ScoredItem[], date: string): string {
  const top = items.slice(0, 5)
  if (top.length === 0) {
    return `☀️ *Juno Brief — ${date}*\n\nQuiet day. Nothing critical in your space.`
  }

  let msg = `☀️ *Juno Brief — ${date}*\n`
  msg += `_${items.length} items scored from ${new Set(items.map((i) => i.source)).size} sources_\n\n`

  const breaking = top.filter((i) => i.urgency === "breaking")
  const rest = top.filter((i) => i.urgency !== "breaking")

  if (breaking.length > 0) {
    msg += `🔴 *BREAKING*\n`
    for (const item of breaking) {
      msg += `• *${item.title}*\n  ${item.whyItMatters}\n\n`
    }
  }

  if (rest.length > 0) {
    msg += `🟡 *TODAY*\n`
    for (const item of rest) {
      msg += `• ${item.title}\n  ${item.whyItMatters}\n\n`
    }
  }

  if (items.length > 5) {
    msg += `_+${items.length - 5} more on your dashboard_\n`
  }

  msg += `\n_Reply "more" for full brief_`
  return msg
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
                  ? "🛠️ Tools & releases"
                  : "💡 Opportunities"

    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }

  for (const [section, sectionItems] of Object.entries(groups)) {
    md += `## ${section}\n\n`
    for (const item of sectionItems) {
      md += `**${item.title}** (${item.source})\n`
      md += `${item.whyItMatters}\n`
      md += `[Read more](${item.url})\n\n`
    }
  }

  return md
}

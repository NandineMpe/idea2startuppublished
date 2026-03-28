import type { CompetitorTrackingRow, FundingTrackerRow } from "@/lib/juno/competitor-persistence"

function groupByCompetitor(events: CompetitorTrackingRow[]): Map<string, CompetitorTrackingRow[]> {
  const m = new Map<string, CompetitorTrackingRow[]>()
  for (const e of events) {
    const key = e.competitor_name
    const arr = m.get(key) ?? []
    arr.push(e)
    m.set(key, arr)
  }
  return m
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function buildCompetitorVaultMarkdown(
  events: CompetitorTrackingRow[],
  funding: FundingTrackerRow[],
  dateIso: string,
): string {
  const byName = groupByCompetitor(events)

  let md = `---\ndate: ${dateIso}\ntype: competitor-landscape\nauto_updated: true\n---\n\n`
  md += `# Competitor landscape\n\n`
  md += `_Auto-updated by Juno. Add your notes below the auto sections — they sync with the repo and inform agents._\n\n`

  if (byName.size === 0 && funding.length === 0) {
    md += `No tracked competitor events yet. They appear as the daily brief scores funding and competitor moves.\n\n`
    return md
  }

  const names = [...byName.keys()].sort((a, b) => a.localeCompare(b))
  for (const name of names) {
    const list = byName.get(name) ?? []
    const latest = list[0]
    md += `## ${name}\n\n`
    md += `- **Latest**: ${latest.title}`
    if (latest.event_date) md += ` — ${formatDateShort(latest.event_date)}`
    md += `\n`
    if (latest.threat_level) md += `- **Threat level**: ${latest.threat_level}\n`
    md += `- **Event type**: ${latest.event_type.replace(/_/g, " ")}\n`
    if (list.length > 1) {
      md += `- **Recent moves**: ${list.length} events in the tracking window\n`
    }
    md += `\n`
  }

  if (funding.length > 0) {
    md += `## Funding in our space (last 90 days)\n\n`
    md += `| Company | Round | Amount | Lead | Date |\n`
    md += `|---------|-------|--------|------|------|\n`
    for (const r of funding) {
      const tag = r.is_competitor ? "⚠️ " : ""
      const round = r.round_type || "—"
      const amt = r.amount || "—"
      const lead = r.lead_investor || "undisclosed"
      const date = formatDateShort(r.announced_date || r.discovered_at)
      md += `| ${tag}${r.company_name} | ${round} | ${amt} | ${lead} | ${date} |\n`
    }
    md += `\n`
  }

  if (funding.length >= 2) {
    md += `**Market signal**: Multiple rounds in this window — pattern matters for strategy and fundraising timing.\n\n`
  }

  md += `---\n\n## Your notes\n\n_(Founder annotations here merge with the vault and company brain.)_\n`

  return md
}

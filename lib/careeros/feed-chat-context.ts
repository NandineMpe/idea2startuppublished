/**
 * Formats feed + enrichment for Juno CareerOS chat (skill crosswalk, named products).
 */

export type FeedItemPayload = {
  summary?: string
  entities?: {
    models?: string[]
    companies?: string[]
    capabilities?: string[]
  }
  affected_skills?: string[]
  affected_functions?: string[]
  source_key?: string
  source_url?: string
}

export type FeedRowForChat = {
  title: string
  feed_type: string | null
  feed_at: string | null
  personalised_note: string | null
  relevance_score: number | null
  item_payload: unknown
  source_attribution: unknown
}

export type EnrichedLandscapeRow = {
  enriched_summary: string
  entity_type: string
  entities: unknown
  affected_functions: string[] | null
  affected_skills: string[] | null
  significance_score: number | null
  feed_source_items: { title: string; source_key: string; published_at: string } | null
}

function normalizeSkillKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function tokens(name: string): string[] {
  return normalizeSkillKey(name)
    .split("-")
    .filter((t) => t.length >= 3)
}

export function skillMatchesUser(affected: string, userSkillNames: string[]): string[] {
  const aKey = normalizeSkillKey(affected)
  const aTokens = tokens(affected)
  const hits: string[] = []
  for (const u of userSkillNames) {
    const uKey = normalizeSkillKey(u)
    if (uKey === aKey || uKey.includes(aKey) || aKey.includes(uKey)) {
      hits.push(u)
      continue
    }
    const uTokens = tokens(u)
    if (aTokens.some((at) => uTokens.some((ut) => ut === at || ut.includes(at) || at.includes(ut)))) {
      hits.push(u)
    }
  }
  return hits
}

export function parseFeedPayload(raw: unknown): FeedItemPayload {
  if (!raw || typeof raw !== "object") return {}
  const p = raw as Record<string, unknown>
  const entities =
    p.entities && typeof p.entities === "object" ? (p.entities as FeedItemPayload["entities"]) : undefined
  return {
    summary: typeof p.summary === "string" ? p.summary : undefined,
    entities,
    affected_skills: Array.isArray(p.affected_skills)
      ? p.affected_skills.filter((s): s is string => typeof s === "string")
      : undefined,
    affected_functions: Array.isArray(p.affected_functions)
      ? p.affected_functions.filter((s): s is string => typeof s === "string")
      : undefined,
    source_key: typeof p.source_key === "string" ? p.source_key : undefined,
    source_url: typeof p.source_url === "string" ? p.source_url : undefined,
  }
}

function formatEntities(entities: FeedItemPayload["entities"]): string {
  if (!entities) return ""
  const parts: string[] = []
  if (entities.companies?.length) parts.push(`Companies: ${entities.companies.join(", ")}`)
  if (entities.models?.length) parts.push(`Models/products: ${entities.models.join(", ")}`)
  if (entities.capabilities?.length) parts.push(`Capabilities: ${entities.capabilities.slice(0, 6).join(", ")}`)
  return parts.join(" · ")
}

export function formatFeedItemForChat(
  item: FeedRowForChat,
  userSkillNames: string[],
  index: number,
): string {
  const payload = parseFeedPayload(item.item_payload)
  const src =
    item.source_attribution && typeof item.source_attribution === "object"
      ? String((item.source_attribution as { source?: string }).source ?? payload.source_key ?? "")
      : payload.source_key ?? ""
  const score =
    typeof item.relevance_score === "number" ? ` · relevance ${item.relevance_score.toFixed(2)}` : ""
  const lines: string[] = [
    `### ${index + 1}. ${item.title} (${item.feed_type ?? "update"}${score}${src ? ` · ${src}` : ""})`,
  ]
  if (payload.summary) lines.push(`Summary: ${payload.summary}`)
  const ent = formatEntities(payload.entities)
  if (ent) lines.push(ent)
  if (payload.affected_functions?.length) {
    lines.push(`Functions touched: ${payload.affected_functions.join(", ")}`)
  }
  if (payload.affected_skills?.length) {
    lines.push(`Skills touched (feed tags): ${payload.affected_skills.join(", ")}`)
    const matched = new Set<string>()
    for (const a of payload.affected_skills) {
      for (const m of skillMatchesUser(a, userSkillNames)) matched.add(m)
    }
    if (matched.size) {
      lines.push(`Matches YOUR portfolio: ${[...matched].join(", ")}`)
    }
  }
  if (item.personalised_note?.trim()) {
    lines.push(`What this means for you: ${item.personalised_note.trim()}`)
  }
  return lines.join("\n")
}

export function formatEnrichedLandscapeItem(row: EnrichedLandscapeRow, index: number): string {
  const src = row.feed_source_items
  const entities =
    row.entities && typeof row.entities === "object"
      ? (row.entities as FeedItemPayload["entities"])
      : undefined
  const sig =
    typeof row.significance_score === "number" ? row.significance_score.toFixed(2) : "—"
  const lines: string[] = [
    `- [${index + 1}] ${src?.title ?? "Untitled"} (${row.entity_type} · significance ${sig} · ${src?.source_key ?? "source"})`,
    `  ${row.enriched_summary}`,
  ]
  const ent = formatEntities(entities)
  if (ent) lines.push(`  ${ent}`)
  if (row.affected_skills?.length) {
    lines.push(`  Skills touched: ${row.affected_skills.join(", ")}`)
  }
  if (row.affected_functions?.length) {
    lines.push(`  Functions touched: ${row.affected_functions.join(", ")}`)
  }
  return lines.join("\n")
}

/** Maps each user skill to feed headlines that mention it (or close tags). */
export function buildSkillToFeedCrosswalk(
  userSkillNames: string[],
  feedRows: FeedRowForChat[],
): string[] {
  const lines: string[] = []
  for (const skill of userSkillNames.slice(0, 25)) {
    const linked: string[] = []
    for (const item of feedRows) {
      const payload = parseFeedPayload(item.item_payload)
      const affected = payload.affected_skills ?? []
      const hit =
        affected.some((a) => skillMatchesUser(a, [skill]).length > 0) ||
        (payload.summary?.toLowerCase().includes(skill.toLowerCase()) ?? false) ||
        item.title.toLowerCase().includes(skill.toLowerCase().split(" ")[0] ?? "")
      if (hit) linked.push(item.title)
    }
    if (linked.length) {
      lines.push(`- ${skill} ← ${linked.slice(0, 3).join("; ")}`)
    }
  }
  const uncovered = userSkillNames.filter(
    (s) => !lines.some((l) => l.startsWith(`- ${s} `)),
  )
  if (uncovered.length) {
    lines.push(
      `Skills with no direct feed hit this week (still name how AI tooling could shift them): ${uncovered.slice(0, 12).join(", ")}`,
    )
  }
  return lines
}

import type { ProfileExtraction } from "@/lib/careeros/schemas/profile-extraction.v1"

function slugifySkillKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "skill"
}

function parseMonthYear(token: string): string | null {
  const months: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  }
  const m = token.trim().match(/^([A-Za-z]+)\s+(\d{4})$/i)
  if (!m) return null
  const mm = months[m[1].toLowerCase()]
  return mm ? `${m[2]}-${mm}` : null
}

function parseDateRange(line: string): { start: string; end: string; isCurrent: boolean } | null {
  const present = /present|current/i.test(line)
  const range = line.match(
    /([A-Za-z]+\s+\d{4})\s*[–—-]\s*([A-Za-z]+\s+\d{4}|present|current)/i,
  )
  if (!range) return null
  const start = parseMonthYear(range[1])
  if (!start) return null
  const endRaw = range[2]
  if (present || /present|current/i.test(endRaw)) {
    return { start, end: "present", isCurrent: true }
  }
  const end = parseMonthYear(endRaw)
  if (!end) return null
  return { start, end, isCurrent: false }
}

function extractBulletLines(section: string): string[] {
  return section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.replace(/^-\s+/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length > 2)
}

function sectionBody(markdown: string, heading: string): string {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, "im")
  const match = re.exec(markdown)
  if (!match || match.index === undefined) return ""
  const start = match.index + match[0].length
  const rest = markdown.slice(start)
  const next = rest.search(/^##\s+/m)
  return (next === -1 ? rest : rest.slice(0, next)).trim()
}

function parseSkillsFromMarkdown(markdown: string): ProfileExtraction["skills"] {
  const seen = new Set<string>()
  const skills: ProfileExtraction["skills"] = []
  const add = (raw: string, evidence: string) => {
    const skill_name = raw.replace(/\*\*/g, "").trim()
    if (skill_name.length < 2 || skill_name.length > 120) return
    const canonical_skill_key = slugifySkillKey(skill_name)
    if (seen.has(canonical_skill_key)) return
    seen.add(canonical_skill_key)
    skills.push({
      skill_name,
      canonical_skill_key,
      proficiency_band: null,
      source_type: "llm_markdown",
      evidence: evidence.slice(0, 500),
    })
  }

  for (const line of extractBulletLines(sectionBody(markdown, "Current Position"))) {
    add(line.split(":")[0] ?? line, line)
  }

  const tech = sectionBody(markdown, "Technical Skills")
  for (const block of tech.split(/^###\s+/m).slice(1)) {
    const header = block.split("\n")[0]?.trim() ?? ""
    for (const line of extractBulletLines(block)) {
      const label = line.split("—")[0]?.split("–")[0]?.trim() ?? line
      add(label, `${header}: ${line}`)
    }
  }

  return skills.slice(0, 80)
}

function parsePastRoles(markdown: string): ProfileExtraction["past_roles"] {
  const history = sectionBody(markdown, "Career History")
  const roles: ProfileExtraction["past_roles"] = []
  const blocks = history.split(/^###\s+/m).slice(1)

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean)
    const company = lines[0]?.replace(/\*\*/g, "").trim() ?? "Unknown company"
    const titleLine = lines.find((l) => l.startsWith("**") && l.includes("|")) ?? lines[1] ?? ""
    const titleMatch = titleLine.match(/\*\*([^*]+)\*\*/)
    const title = titleMatch?.[1]?.trim() ?? titleLine.replace(/\*\*/g, "").split("|")[0]?.trim() ?? "Role"
    const dates = parseDateRange(titleLine) ?? parseDateRange(lines.join(" "))
    if (!dates) continue
    roles.push({
      title,
      company,
      start_date: dates.start,
      end_date: dates.end,
      description: lines.slice(2, 6).join(" ").slice(0, 500) || title,
      is_current: dates.isCurrent,
    })
  }

  const current = sectionBody(markdown, "Current Position")
  const currentTitle = current.match(/\*\*([^*]+)\*\*\s*[—–-]\s*([^\n]+)/)
  const currentDates = parseDateRange(current)
  if (currentTitle && currentDates) {
    roles.unshift({
      title: currentTitle[1].trim(),
      company: current.split("\n")[1]?.split("|")[0]?.trim() ?? "Current employer",
      start_date: currentDates.start,
      end_date: currentDates.end,
      description: current.slice(0, 400),
      is_current: true,
    })
  }

  return roles.slice(0, 20)
}

function parseEducation(markdown: string): ProfileExtraction["education"] {
  const quals = sectionBody(markdown, "Qualifications")
  const items: ProfileExtraction["education"] = []
  for (const block of quals.split(/^###\s+/m).slice(1)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean)
    const heading = lines[0]?.replace(/\*\*/g, "").trim() ?? ""
    const detail = lines[1] ?? ""
    const yearMatch = detail.match(/\b(19|20)\d{2}\b/)
    items.push({
      institution: detail.split("|")[0]?.trim() || heading,
      degree: heading,
      field_of_study: null,
      graduation_year: yearMatch ? Number(yearMatch[0]) : null,
    })
  }
  return items.slice(0, 12)
}

function parseAchievements(markdown: string): string[] {
  return extractBulletLines(sectionBody(markdown, "Notable Matters")).slice(0, 15)
}

function parseCurrentRole(markdown: string, stated: string | null): string {
  if (stated?.trim()) return stated.trim()
  const fromMeta = markdown.match(/\*\*Current Role:\*\*\s*(.+)/i)?.[1]?.trim()
  if (fromMeta) return fromMeta
  const pos = sectionBody(markdown, "Current Position")
  const m = pos.match(/\*\*([^*]+)\*\*/)
  return m?.[1]?.trim() ?? ""
}

function parseYears(markdown: string, stated: number | null): number {
  if (typeof stated === "number" && stated > 0) return stated
  const pqe = markdown.match(/(\d+)\s*PQE/i)?.[1]
  if (pqe) return Number(pqe)
  return 0
}

/**
 * Deterministic parser for LLM-generated career markdown (Module 1.1 export).
 * Used when structured LLM extraction fails but markdown context exists.
 */
export function extractProfileFromLlmMarkdown(
  markdown: string,
  options?: {
    userStatedRole?: string | null
    userStatedYearsExperience?: number | null
  },
): ProfileExtraction {
  const trimmed = markdown.trim()
  const skills = parseSkillsFromMarkdown(trimmed)
  const past_roles = parsePastRoles(trimmed)
  const education = parseEducation(trimmed)
  const notable_achievements = parseAchievements(trimmed)

  return {
    current_role: parseCurrentRole(trimmed, options?.userStatedRole ?? null),
    years_experience: parseYears(trimmed, options?.userStatedYearsExperience ?? null),
    skills,
    past_roles,
    education,
    notable_achievements,
  }
}

export function hasMarkdownProfileSignal(extraction: ProfileExtraction): boolean {
  return (
    extraction.skills.length > 0 ||
    extraction.past_roles.length > 0 ||
    extraction.education.length > 0 ||
    extraction.notable_achievements.length > 0
  )
}

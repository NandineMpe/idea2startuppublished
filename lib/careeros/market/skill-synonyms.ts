import { supabaseAdmin } from "@/lib/supabase"

export type SynonymMap = Map<string, string>

export function normaliseSkillKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
}

export async function loadSkillSynonymMap(): Promise<SynonymMap> {
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("skill_synonyms")
    .select("synonym_key,canonical_skill_key")
    .limit(5000)
  if (error) throw error
  const m = new Map<string, string>()
  for (const row of data ?? []) {
    const s = normaliseSkillKey(String(row.synonym_key))
    const c = normaliseSkillKey(String(row.canonical_skill_key))
    if (s && c) m.set(s, c)
  }
  return m
}

export function resolveCanonicalSkillKey(
  raw: string,
  synonyms: SynonymMap,
): string {
  const key = normaliseSkillKey(raw)
  return synonyms.get(key) ?? key
}

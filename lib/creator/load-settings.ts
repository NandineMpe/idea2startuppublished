import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingRelation } from "./query"
import {
  DEFAULT_CPM_HIGH,
  DEFAULT_CPM_LOW,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  type CreatorCurrency,
  type CreatorSettings,
  type CreatorSettingsContext,
} from "./types"

export const DEFAULT_CREATOR_SETTINGS: CreatorSettings = {
  currency: DEFAULT_CURRENCY,
  cpm_low: DEFAULT_CPM_LOW,
  cpm_high: DEFAULT_CPM_HIGH,
  tiktok_handle: null,
  niche_topics: [],
}

export function isSupportedCurrency(value: unknown): value is CreatorCurrency {
  return typeof value === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

/** Coerces a stored row into settings, falling back per-field so one bad column cannot blank the form. */
function normalise(row: Partial<CreatorSettings> | null): CreatorSettings {
  if (!row) return DEFAULT_CREATOR_SETTINGS

  return {
    currency: isSupportedCurrency(row.currency) ? row.currency : DEFAULT_CREATOR_SETTINGS.currency,
    cpm_low: typeof row.cpm_low === "number" && row.cpm_low > 0 ? row.cpm_low : DEFAULT_CREATOR_SETTINGS.cpm_low,
    cpm_high:
      typeof row.cpm_high === "number" && row.cpm_high > 0 ? row.cpm_high : DEFAULT_CREATOR_SETTINGS.cpm_high,
    tiktok_handle: typeof row.tiktok_handle === "string" && row.tiktok_handle.trim() ? row.tiktok_handle.trim() : null,
    niche_topics: Array.isArray(row.niche_topics)
      ? row.niche_topics.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : [],
  }
}

export async function loadCreatorSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreatorSettingsContext> {
  const { data, error } = await supabase
    .schema("creator")
    .from("creator_settings")
    .select("currency,cpm_low,cpm_high,tiktok_handle,niche_topics")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    if (isMissingRelation(error)) {
      return { settings: DEFAULT_CREATOR_SETTINGS, persisted: false }
    }
    throw error
  }

  return { settings: normalise(data as Partial<CreatorSettings> | null), persisted: true }
}

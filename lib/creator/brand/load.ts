import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "../query"
import { PROTOCOL_SEEDS, type Presentation, type ProtocolCategory } from "./protocols"
import { annualSpend, assessProtocol, daysBetween, parseDateOnly, sortByUrgency, type ProtocolState } from "./readiness"

export type BrandProtocol = {
  id: string | null
  protocol_key: string
  label: string
  category: ProtocolCategory
  active: boolean
  lead_days_before_camera: number
  peak_days_after: number
  repeat_weeks: number | null
  last_paid: number | null
  best_quote: number | null
  provider: string | null
  last_done_at: string | null
  notes: string | null
  state: ProtocolState
}

export type BrandDeal = {
  id: string
  title: string
  provider: string | null
  url: string | null
  source: string | null
  price: number | null
  normal_price: number | null
  protocol_key: string | null
  expires_on: string | null
  state: string
  /** Whole days until it expires. Negative means it already has. */
  days_left: number | null
}

export type BrandContext = {
  protocols: BrandProtocol[]
  deals: BrandDeal[]
  next_shoot_at: string | null
  presentation: Presentation | null
  currency: string
  annual_total: number
  annual_unknown: number
}

const PROTOCOL_COLUMNS =
  // One literal, never concatenated: PostgREST parses this at the type level.
  "id,protocol_key,label,category,active,lead_days_before_camera,peak_days_after,repeat_weeks,last_paid,best_quote,provider,last_done_at,notes"

const DEAL_COLUMNS = "id,title,provider,url,source,price,normal_price,protocol_key,expires_on,state"

type ProtocolRow = Omit<BrandProtocol, "state" | "id"> & { id: string }
type DealRow = Omit<BrandDeal, "days_left">

/**
 * The register, with every seed present whether or not she has a row for it.
 *
 * Unstarted treatments are returned as inactive seeds rather than hidden, for
 * the same reason unbuilt industries are: the screen should show what it could
 * track, not only what it already does. The difference is that these default to
 * inactive, because a register that opens with thirteen treatments switched on
 * is a shopping list wearing the costume of a record.
 */
export async function loadBrand(supabase: SupabaseClient, userId: string): Promise<BrandContext> {
  const [rows, deals, settings] = await Promise.all([
    safeRows<ProtocolRow>(
      supabase
        .schema("creator")
        .from("creator_brand_protocols")
        .select(PROTOCOL_COLUMNS)
        .eq("user_id", userId)
        .is("deleted_at", null),
    ),
    safeRows<DealRow>(
      supabase
        .schema("creator")
        .from("creator_brand_deals")
        .select(DEAL_COLUMNS)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("expires_on", { ascending: true, nullsFirst: false }),
    ),
    supabase
      .schema("creator")
      .from("creator_settings")
      .select("currency,next_shoot_at,presentation")
      .eq("user_id", userId)
      .maybeSingle(),
  ])

  const nextShoot = (settings.data?.next_shoot_at as string | null) ?? null
  const presentation = (settings.data?.presentation as Presentation | null) ?? null
  const shootDate = nextShoot ? parseDateOnly(nextShoot) : null
  const byKey = new Map(rows.map((r) => [r.protocol_key, r]))

  const protocols: BrandProtocol[] = PROTOCOL_SEEDS.map((seed) => {
    const row = byKey.get(seed.key)
    const merged = {
      id: row?.id ?? null,
      protocol_key: seed.key,
      label: row?.label ?? seed.label,
      category: (row?.category as ProtocolCategory) ?? seed.category,
      active: row?.active ?? false,
      // Her edits win over the defaults. The defaults are a starting point and
      // she is the one who knows how her own skin behaves.
      lead_days_before_camera: row?.lead_days_before_camera ?? seed.lead_days_before_camera,
      peak_days_after: row?.peak_days_after ?? seed.peak_days_after,
      repeat_weeks: row?.repeat_weeks ?? seed.repeat_weeks,
      // numeric(10,2) arrives as a string over PostgREST.
      last_paid: row?.last_paid === null || row?.last_paid === undefined ? null : Number(row.last_paid),
      best_quote: row?.best_quote === null || row?.best_quote === undefined ? null : Number(row.best_quote),
      provider: row?.provider ?? null,
      last_done_at: row?.last_done_at ?? null,
      notes: row?.notes ?? null,
    }
    return { ...merged, state: assessProtocol(merged, shootDate) }
  })

  // Anything she added herself.
  for (const row of rows) {
    if (PROTOCOL_SEEDS.some((s) => s.key === row.protocol_key)) continue
    const merged = {
      ...row,
      id: row.id,
      last_paid: row.last_paid === null ? null : Number(row.last_paid),
      best_quote: row.best_quote === null ? null : Number(row.best_quote),
    }
    protocols.push({ ...merged, state: assessProtocol(merged, shootDate) })
  }

  const active = protocols.filter((p) => p.active)
  const inactive = protocols.filter((p) => !p.active)
  const spend = annualSpend(active)

  const now = new Date()
  const withDaysLeft: BrandDeal[] = deals.map((d) => ({
    ...d,
    price: d.price === null ? null : Number(d.price),
    normal_price: d.normal_price === null ? null : Number(d.normal_price),
    days_left: d.expires_on ? daysBetween(now, parseDateOnly(d.expires_on)) : null,
  }))

  return {
    // Active first and sorted by what could still go wrong, then the rest of
    // the catalogue as a menu.
    protocols: [...sortByUrgency(active.map((p) => p.state)).map((s) => active.find((p) => p.protocol_key === s.protocol_key)!), ...inactive],
    deals: withDaysLeft,
    next_shoot_at: nextShoot,
    presentation,
    currency: (settings.data?.currency as string) ?? "EUR",
    annual_total: spend.total,
    annual_unknown: spend.unknown,
  }
}

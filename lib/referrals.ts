import "server-only"

import { randomBytes } from "node:crypto"
import { resolveAppUrl } from "@/lib/app-url"
import { normalizeReferralCodeParam } from "@/lib/referral-code"
import { supabaseAdmin } from "@/lib/supabase"

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
const CODE_LENGTH = 8

function generateReferralCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let out = ""
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]
  }
  return out
}

export { normalizeReferralCodeParam } from "@/lib/referral-code"

export async function getReferrerUserIdFromCode(code: string): Promise<string | null> {
  const normalized = normalizeReferralCodeParam(code)
  if (!normalized) return null

  const { data, error } = await supabaseAdmin
    .from("user_referral_codes")
    .select("user_id")
    .eq("code", normalized)
    .maybeSingle()

  if (error || !data?.user_id) return null
  return String(data.user_id)
}

/**
 * Ensures the user has a stable referral code (used in share links).
 */
export async function ensureReferralCodeForUser(userId: string): Promise<string> {
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("user_referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle()

  if (exErr) {
    console.error("[referrals] read code:", exErr.message)
  }
  if (existing?.code) {
    return String(existing.code)
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateReferralCode()
    const { error: insErr } = await supabaseAdmin.from("user_referral_codes").insert({
      user_id: userId,
      code,
    })

    if (!insErr) return code
    if (/unique|duplicate/i.test(insErr.message)) continue
    console.error("[referrals] insert code:", insErr.message)
    throw new Error("Could not create referral link.")
  }

  throw new Error("Could not create referral link.")
}

export async function countReferralsForUser(referrerUserId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("user_referral_attributions")
    .select("referred_user_id", { count: "exact", head: true })
    .eq("referrer_user_id", referrerUserId)

  if (error) {
    console.error("[referrals] count:", error.message)
    return 0
  }
  return count ?? 0
}

export function buildProductInviteShareUrl(code: string, origin?: string | null): string {
  const base = resolveAppUrl(origin)
  const url = new URL("/", base)
  url.searchParams.set("ref", code)
  return url.toString()
}

/**
 * Records first-touch referral when a new account signs up with a valid ref cookie.
 */
export async function recordReferralAttributionIfEligible(params: {
  referredUserId: string
  referralCodeFromCookie: string
}): Promise<void> {
  const referrerId = await getReferrerUserIdFromCode(params.referralCodeFromCookie)
  if (!referrerId || referrerId === params.referredUserId) return

  const { error } = await supabaseAdmin.from("user_referral_attributions").insert({
    referred_user_id: params.referredUserId,
    referrer_user_id: referrerId,
  })

  if (error) {
    if (/unique|duplicate/i.test(error.message)) return
    console.error("[referrals] attribution:", error.message)
  }
}

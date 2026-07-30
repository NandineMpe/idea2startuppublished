import type { SupabaseClient } from "@supabase/supabase-js"

export type CareerOsProfileUpsertInput = {
  userId: string
  currentRoleTitle: string
  targetRoleTitle: string | null
  locationLabel: string
  locationRegionCode: string | null
  yearsExperience: number | null
  currentSalaryUsd: number | null
  updatedAt: string
}

function isMissingColumnError(message: string, column: string): boolean {
  const m = message.toLowerCase()
  const col = column.toLowerCase()
  return (
    m.includes(col) &&
    (m.includes("could not find") ||
      m.includes("does not exist") ||
      m.includes("schema cache") ||
      m.includes("column"))
  )
}

function toErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message)
  }
  return error instanceof Error ? error.message : String(error)
}

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code)
  }
  return undefined
}

async function runUpsert(
  client: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ error: unknown | null }> {
  const { error } = await client
    .schema("careeros")
    .from("user_profiles")
    .upsert(row, { onConflict: "user_id" })
  return { error }
}

/**
 * Upsert careeros.user_profiles with fallback when optional columns are missing in DB.
 */
export async function upsertCareerOsUserProfile(
  client: SupabaseClient,
  input: CareerOsProfileUpsertInput,
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const base = {
    user_id: input.userId,
    current_role_title: input.currentRoleTitle,
    target_role_title: input.targetRoleTitle,
    location_label: input.locationLabel,
    years_experience: input.yearsExperience,
    updated_at: input.updatedAt,
  }

  const withRegion = {
    ...base,
    location_region_code: input.locationRegionCode,
  }

  const withSalary = {
    ...withRegion,
    current_salary_usd: input.currentSalaryUsd,
  }

  const rowVariants: Array<Record<string, unknown>> = [withSalary, withRegion, base]

  let lastMessage = "Could not save profile"
  let lastCode: string | undefined

  for (const row of rowVariants) {
    const { error } = await runUpsert(client, row)
    if (!error) return { ok: true }

    lastMessage = toErrorMessage(error)
    lastCode = errorCode(error)

    if (isMissingColumnError(lastMessage, "current_salary_usd")) continue
    if (isMissingColumnError(lastMessage, "location_region_code")) continue

    break
  }

  if (lastCode === "42501" || /permission denied/i.test(lastMessage)) {
    return {
      ok: false,
      code: lastCode,
      message:
        "Database permission error saving your profile. Apply CareerOS migrations (including service_role grants).",
    }
  }

  if (isMissingColumnError(lastMessage, "current_salary_usd")) {
    return {
      ok: false,
      code: lastCode,
      message:
        "Profile save failed: salary column missing in database. Apply migration careeros_20260511_user_profile_current_salary.sql, or leave salary blank and retry.",
    }
  }

  return { ok: false, code: lastCode, message: lastMessage }
}

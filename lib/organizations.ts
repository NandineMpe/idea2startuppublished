import { randomUUID } from "crypto"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase"

export const ACTIVE_ORGANIZATION_COOKIE = "juno_active_organization"

export type OrganizationRole = "owner" | "admin" | "member"

export interface OrganizationRecord {
  id: string
  slug: string
  displayName: string
  isPersonal: boolean
  createdAt: string
  /** Present when listing memberships for the current user */
  role?: OrganizationRole
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

function isValidCustomSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 50 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

function slugifyName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)

  return slug || "team"
}

async function slugExists(slug: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()

  if (error && error.code !== "PGRST116") {
    console.error("[organizations] slugExists:", error.message)
  }

  return Boolean(data?.id)
}

async function generateUniqueTeamSlug(displayName: string): Promise<string> {
  const base = slugifyName(displayName)
  if (!(await slugExists(base))) return base

  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`
    if (!(await slugExists(candidate))) return candidate
  }

  return `${base}-${randomUUID().slice(0, 8)}`
}

export async function readActiveOrganizationIdFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    return normalizeOptionalText(cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value)
  } catch {
    return null
  }
}

function mapOrgRow(row: Record<string, unknown>): OrganizationRecord {
  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    displayName: String(row.display_name ?? "Organization"),
    isPersonal: Boolean(row.is_personal),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

export async function listOrganizationsForUser(userId: string): Promise<OrganizationRecord[]> {
  const { data: members, error: memErr } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)

  if (memErr) {
    console.error("[organizations] list members:", memErr.message)
    return []
  }

  const ids = [...new Set((members ?? []).map((m) => String(m.organization_id)))]
  if (ids.length === 0) return []

  const roleByOrg = new Map<string, OrganizationRole>()
  for (const m of members ?? []) {
    roleByOrg.set(String(m.organization_id), m.role as OrganizationRole)
  }

  const { data: orgs, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .select("id, slug, display_name, is_personal, created_at")
    .in("id", ids)

  if (orgErr) {
    console.error("[organizations] list orgs:", orgErr.message)
    return []
  }

  const out = (orgs ?? []).map((row) => {
    const rec = mapOrgRow(row as unknown as Record<string, unknown>)
    rec.role = roleByOrg.get(rec.id)
    return rec
  })

  out.sort((a, b) => {
    if (a.isPersonal !== b.isPersonal) return a.isPersonal ? -1 : 1
    return a.createdAt.localeCompare(b.createdAt)
  })

  return out
}

export async function getMembershipRole(
  userId: string,
  organizationId: string,
): Promise<OrganizationRole | null> {
  const { data, error } = await supabaseAdmin
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error || !data?.role) return null
  return data.role as OrganizationRole
}

export async function getOrganizationByIdForUser(
  userId: string,
  organizationId: string,
): Promise<OrganizationRecord | null> {
  const { data: member, error: memErr } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (memErr || !member) return null

  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .select("id, slug, display_name, is_personal, created_at")
    .eq("id", organizationId)
    .maybeSingle()

  if (error || !org) return null
  return mapOrgRow(org as unknown as Record<string, unknown>)
}

/**
 * Ensures the user has a personal organization (for legacy accounts and new signups).
 */
export async function ensurePersonalOrganization(
  userId: string,
  options: {
    displayName?: string | null
    requestedSlug?: string | null
  } = {},
): Promise<OrganizationRecord> {
  const requestedName = normalizeOptionalText(options.displayName)
  const requestedSlugRaw = normalizeOptionalText(options.requestedSlug)
  const requestedSlug = requestedSlugRaw ? normalizeSlugInput(requestedSlugRaw) : null

  if (requestedSlug && !isValidCustomSlug(requestedSlug)) {
    throw new Error(
      "Organization slug must be 3-50 chars, lowercase letters/numbers, and optional single hyphens.",
    )
  }

  const { data: existing, error: findErr } = await supabaseAdmin
    .from("organizations")
    .select("id, slug, display_name, is_personal, created_at")
    .eq("created_by_user_id", userId)
    .eq("is_personal", true)
    .maybeSingle()

  if (!findErr && existing) {
    const existingRow = existing as unknown as Record<string, unknown>
    const existingSlug = String(existingRow.slug ?? "")
    const existingName = String(existingRow.display_name ?? "")

    const patch: Record<string, unknown> = {}
    if (requestedName && requestedName !== existingName) {
      patch.display_name = requestedName
    }
    if (requestedSlug && requestedSlug !== existingSlug) {
      patch.slug = requestedSlug
    }

    if (Object.keys(patch).length === 0) {
      return mapOrgRow(existingRow)
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("organizations")
      .update(patch)
      .eq("id", String(existingRow.id))
      .select("id, slug, display_name, is_personal, created_at")
      .single()

    if (updateErr || !updated) {
      if (requestedSlug && /duplicate|unique|organizations_slug_key/i.test(updateErr?.message ?? "")) {
        throw new Error(`Organization slug "${requestedSlug}" is already taken.`)
      }
      throw new Error(updateErr?.message || "Failed to update personal organization")
    }

    return mapOrgRow(updated as unknown as Record<string, unknown>)
  }

  const slug = requestedSlug ?? `u-${userId.replace(/-/g, "")}`
  const { data: created, error: insErr } = await supabaseAdmin
    .from("organizations")
    .insert({
      slug,
      display_name: requestedName ?? "Personal",
      is_personal: true,
      created_by_user_id: userId,
    })
    .select("id, slug, display_name, is_personal, created_at")
    .single()

  if (insErr || !created) {
    if (requestedSlug && /duplicate|unique|organizations_slug_key/i.test(insErr?.message ?? "")) {
      throw new Error(`Organization slug "${requestedSlug}" is already taken.`)
    }

    const { data: retry } = await supabaseAdmin
      .from("organizations")
      .select("id, slug, display_name, is_personal, created_at")
      .eq("created_by_user_id", userId)
      .eq("is_personal", true)
      .maybeSingle()

    if (retry) return mapOrgRow(retry as unknown as Record<string, unknown>)
    throw new Error(insErr?.message || "Failed to create personal organization")
  }

  const { error: memErr } = await supabaseAdmin.from("organization_members").insert({
    organization_id: created.id,
    user_id: userId,
    role: "owner",
  })

  if (memErr && !/duplicate|unique/i.test(memErr.message)) {
    console.error("[organizations] ensurePersonalOrganization member:", memErr.message)
  }

  return mapOrgRow(created as unknown as Record<string, unknown>)
}

export async function createTeamOrganization(
  userId: string,
  displayName: string,
): Promise<OrganizationRecord> {
  const name = normalizeOptionalText(displayName) || "Team"
  const slug = await generateUniqueTeamSlug(name)

  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .insert({
      slug,
      display_name: name,
      is_personal: false,
      created_by_user_id: userId,
    })
    .select("id, slug, display_name, is_personal, created_at")
    .single()

  if (error || !org) {
    throw new Error(error?.message || "Failed to create organization")
  }

  const { error: memErr } = await supabaseAdmin.from("organization_members").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  })

  if (memErr) {
    throw new Error(memErr.message)
  }

  return mapOrgRow(org as unknown as Record<string, unknown>)
}

export async function resolveOrganizationSelection(
  userId: string,
  options: {
    organizationId?: string | null
    useCookieOrganization?: boolean
  } = {},
): Promise<OrganizationRecord | null> {
  await ensurePersonalOrganization(userId)
  const orgs = await listOrganizationsForUser(userId)
  if (orgs.length === 0) return null

  const explicit =
    options.organizationId === undefined || options.organizationId === null
      ? null
      : normalizeOptionalText(String(options.organizationId))

  if (explicit) {
    const match = orgs.find((o) => o.id === explicit)
    if (match) return match
  }

  if (options.useCookieOrganization !== false) {
    const cookieId = await readActiveOrganizationIdFromCookie()
    if (cookieId) {
      const match = orgs.find((o) => o.id === cookieId)
      if (match) return match
    }
  }

  return orgs.find((o) => o.isPersonal) ?? orgs[0] ?? null
}

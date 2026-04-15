import { randomUUID } from "crypto"
import { cookies } from "next/headers"
import {
  readActiveOrganizationIdFromCookie,
  resolveOrganizationSelection,
} from "@/lib/organizations"
import { supabaseAdmin } from "@/lib/supabase"
import type { WorkspaceContextStatus, WorkspaceSummary } from "@/types/workspace"

const WORKSPACE_SELECT_BASE = [
  "id",
  "owner_user_id",
  "slug",
  "share_token",
  "display_name",
  "contact_name",
  "contact_email",
  "company_name",
  "context_status",
  "last_context_submitted_at",
  "created_at",
  "updated_at",
].join(", ")

const WORKSPACE_SELECT_WITH_ORG = [
  "id",
  "owner_user_id",
  "organization_id",
  "slug",
  "share_token",
  "display_name",
  "contact_name",
  "contact_email",
  "company_name",
  "context_status",
  "last_context_submitted_at",
  "created_at",
  "updated_at",
].join(", ")

export const ACTIVE_WORKSPACE_COOKIE = "juno_active_workspace"

export interface WorkspaceRecord extends WorkspaceSummary {
  ownerUserId: string
  organizationId: string | null
  shareToken: string
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function isMissingOrganizationColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code !== "42703") return false
  return /organization_id/i.test(error.message ?? "")
}

function normalizeStatus(value: unknown): WorkspaceContextStatus {
  if (value === "intake_started" || value === "ready") return value
  return "draft"
}

function slugifyWorkspaceName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)

  return slug || "workspace"
}

function mapWorkspaceRow(row: Record<string, unknown>): WorkspaceRecord {
  const shareToken = String(row.share_token ?? "")

  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    organizationId: normalizeOptionalText(row.organization_id as string | null | undefined),
    shareToken,
    slug: String(row.slug ?? ""),
    displayName: String(row.display_name ?? row.company_name ?? "Client workspace"),
    contactName: normalizeOptionalText(row.contact_name as string | null | undefined),
    contactEmail: normalizeOptionalText(row.contact_email as string | null | undefined),
    companyName: normalizeOptionalText(row.company_name as string | null | undefined),
    contextStatus: normalizeStatus(row.context_status),
    lastContextSubmittedAt:
      (row.last_context_submitted_at as string | null | undefined) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    intakePath: `/intake/${shareToken}`,
  }
}

async function slugExists(slug: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("client_workspaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()

  if (error && error.code !== "PGRST116") {
    console.error("[workspaces] slugExists:", error.message)
  }

  return Boolean(data?.id)
}

async function generateUniqueWorkspaceSlug(displayName: string): Promise<string> {
  const base = slugifyWorkspaceName(displayName)
  if (!(await slugExists(base))) return base

  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`
    if (!(await slugExists(candidate))) return candidate
  }

  return `${base}-${randomUUID().slice(0, 8)}`
}

function generateShareToken(): string {
  return randomUUID().replace(/-/g, "")
}

export async function readActiveWorkspaceIdFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    return normalizeOptionalText(cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value)
  } catch {
    return null
  }
}

export async function listWorkspacesForOwner(
  ownerUserId: string,
  organizationId?: string | null,
): Promise<WorkspaceSummary[]> {
  let query = supabaseAdmin
    .from("client_workspaces")
    .select(WORKSPACE_SELECT_WITH_ORG)
    .eq("owner_user_id", ownerUserId)
    .order("updated_at", { ascending: false })

  const scopedOrganizationId = normalizeOptionalText(organizationId)
  if (scopedOrganizationId) {
    query = query.eq("organization_id", scopedOrganizationId)
  }

  const { data, error } = await query

  if (isMissingOrganizationColumnError(error)) {
    const { data: legacyData, error: legacyError } = await supabaseAdmin
      .from("client_workspaces")
      .select(WORKSPACE_SELECT_BASE)
      .eq("owner_user_id", ownerUserId)
      .order("updated_at", { ascending: false })

    if (legacyError) {
      console.error("[workspaces] listWorkspacesForOwner (legacy):", legacyError.message)
      return []
    }

    return (legacyData ?? []).map((row) => mapWorkspaceRow(row as unknown as Record<string, unknown>))
  }

  if (error) {
    console.error("[workspaces] listWorkspacesForOwner:", error.message)
    return []
  }

  return (data ?? []).map((row) => mapWorkspaceRow(row as unknown as Record<string, unknown>))
}

export async function getWorkspaceRecordByIdForOwner(
  ownerUserId: string,
  workspaceId: string,
  organizationId?: string | null,
): Promise<WorkspaceRecord | null> {
  const id = normalizeOptionalText(workspaceId)
  if (!id) return null

  let query = supabaseAdmin
    .from("client_workspaces")
    .select(WORKSPACE_SELECT_WITH_ORG)
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
  
  const scopedOrganizationId = normalizeOptionalText(organizationId)
  if (scopedOrganizationId) {
    query = query.eq("organization_id", scopedOrganizationId)
  }

  const { data, error } = await query.maybeSingle()

  if (isMissingOrganizationColumnError(error)) {
    const { data: legacyData, error: legacyError } = await supabaseAdmin
      .from("client_workspaces")
      .select(WORKSPACE_SELECT_BASE)
      .eq("id", id)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle()

    if (legacyError && legacyError.code !== "PGRST116") {
      console.error("[workspaces] getWorkspaceRecordByIdForOwner (legacy):", legacyError.message)
      return null
    }

    return legacyData
      ? mapWorkspaceRow(legacyData as unknown as Record<string, unknown>)
      : null
  }

  if (error && error.code !== "PGRST116") {
    console.error("[workspaces] getWorkspaceRecordByIdForOwner:", error.message)
    return null
  }

  return data ? mapWorkspaceRow(data as unknown as Record<string, unknown>) : null
}

export async function getWorkspaceRecordByShareToken(
  shareToken: string,
): Promise<WorkspaceRecord | null> {
  const token = normalizeOptionalText(shareToken)
  if (!token) return null

  const { data, error } = await supabaseAdmin
    .from("client_workspaces")
    .select(WORKSPACE_SELECT_WITH_ORG)
    .eq("share_token", token)
    .maybeSingle()

  if (isMissingOrganizationColumnError(error)) {
    const { data: legacyData, error: legacyError } = await supabaseAdmin
      .from("client_workspaces")
      .select(WORKSPACE_SELECT_BASE)
      .eq("share_token", token)
      .maybeSingle()

    if (legacyError && legacyError.code !== "PGRST116") {
      console.error("[workspaces] getWorkspaceRecordByShareToken (legacy):", legacyError.message)
      return null
    }

    return legacyData
      ? mapWorkspaceRow(legacyData as unknown as Record<string, unknown>)
      : null
  }

  if (error && error.code !== "PGRST116") {
    console.error("[workspaces] getWorkspaceRecordByShareToken:", error.message)
    return null
  }

  return data ? mapWorkspaceRow(data as unknown as Record<string, unknown>) : null
}

export async function resolveWorkspaceSelection(
  ownerUserId: string,
  options: {
    workspaceId?: string | null
    useCookieWorkspace?: boolean
    organizationId?: string | null
    useCookieOrganization?: boolean
  } = {},
): Promise<WorkspaceRecord | null> {
  const explicitId =
    options.workspaceId === undefined ? undefined : normalizeOptionalText(options.workspaceId)

  const candidateId =
    explicitId === undefined
      ? options.useCookieWorkspace === false
        ? null
        : await readActiveWorkspaceIdFromCookie()
      : explicitId

  if (!candidateId) return null

  const explicitOrganizationId =
    options.organizationId === undefined
      ? undefined
      : normalizeOptionalText(options.organizationId)

  const candidateOrganizationId =
    explicitOrganizationId === undefined
      ? options.useCookieOrganization === false
        ? null
        : (
            (await readActiveOrganizationIdFromCookie()) ||
            (await resolveOrganizationSelection(ownerUserId, {
              useCookieOrganization: true,
            }))?.id ||
            null
          )
      : explicitOrganizationId

  return getWorkspaceRecordByIdForOwner(ownerUserId, candidateId, candidateOrganizationId)
}

export async function createWorkspaceForOwner(params: {
  ownerUserId: string
  organizationId?: string | null
  displayName: string
  contactName?: string | null
  contactEmail?: string | null
}): Promise<WorkspaceRecord> {
  const displayName = normalizeOptionalText(params.displayName) || "Client workspace"
  const slug = await generateUniqueWorkspaceSlug(displayName)
  const shareToken = generateShareToken()

  const payload = {
    owner_user_id: params.ownerUserId,
    slug,
    share_token: shareToken,
    display_name: displayName,
    contact_name: normalizeOptionalText(params.contactName),
    contact_email: normalizeOptionalText(params.contactEmail),
    context_status: "draft",
    organization_id: normalizeOptionalText(params.organizationId),
  }

  const { data, error } = await supabaseAdmin
    .from("client_workspaces")
    .insert(payload)
    .select(WORKSPACE_SELECT_WITH_ORG)
    .single()

  if (isMissingOrganizationColumnError(error)) {
    const legacyPayload = {
      owner_user_id: params.ownerUserId,
      slug,
      share_token: shareToken,
      display_name: displayName,
      contact_name: normalizeOptionalText(params.contactName),
      contact_email: normalizeOptionalText(params.contactEmail),
      context_status: "draft",
    }

    const { data: legacyData, error: legacyError } = await supabaseAdmin
      .from("client_workspaces")
      .insert(legacyPayload)
      .select(WORKSPACE_SELECT_BASE)
      .single()

    if (legacyError || !legacyData) {
      throw new Error(legacyError?.message || "Failed to create workspace")
    }

    return mapWorkspaceRow(legacyData as unknown as Record<string, unknown>)
  }

  if (error || !data) {
    throw new Error(error?.message || "Failed to create workspace")
  }

  return mapWorkspaceRow(data as unknown as Record<string, unknown>)
}

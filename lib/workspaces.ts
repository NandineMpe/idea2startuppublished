import { randomUUID } from "crypto"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase"
import type { WorkspaceContextStatus, WorkspaceSummary } from "@/types/workspace"

const WORKSPACE_SELECT = [
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

export const ACTIVE_WORKSPACE_COOKIE = "juno_active_workspace"

export interface WorkspaceRecord extends WorkspaceSummary {
  ownerUserId: string
  shareToken: string
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
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

export async function listWorkspacesForOwner(ownerUserId: string): Promise<WorkspaceSummary[]> {
  const { data, error } = await supabaseAdmin
    .from("client_workspaces")
    .select(WORKSPACE_SELECT)
    .eq("owner_user_id", ownerUserId)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[workspaces] listWorkspacesForOwner:", error.message)
    return []
  }

  return (data ?? []).map((row) => mapWorkspaceRow(row as unknown as Record<string, unknown>))
}

export async function getWorkspaceRecordByIdForOwner(
  ownerUserId: string,
  workspaceId: string,
): Promise<WorkspaceRecord | null> {
  const id = normalizeOptionalText(workspaceId)
  if (!id) return null

  const { data, error } = await supabaseAdmin
    .from("client_workspaces")
    .select(WORKSPACE_SELECT)
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle()

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
    .select(WORKSPACE_SELECT)
    .eq("share_token", token)
    .maybeSingle()

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

  return getWorkspaceRecordByIdForOwner(ownerUserId, candidateId)
}

export async function createWorkspaceForOwner(params: {
  ownerUserId: string
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
  }

  const { data, error } = await supabaseAdmin
    .from("client_workspaces")
    .insert(payload)
    .select(WORKSPACE_SELECT)
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Failed to create workspace")
  }

  return mapWorkspaceRow(data as unknown as Record<string, unknown>)
}

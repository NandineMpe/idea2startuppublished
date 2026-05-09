/**
 * Append CareerOS LLM / markdown context into Juno's central brain
 * (`company_profile.knowledge_base_md` or workspace `client_workspace_profiles`).
 */
import { supabaseAdmin } from "@/lib/supabase"
import { resolveOrganizationSelection } from "@/lib/organizations"
import { resolveWorkspaceSelection } from "@/lib/workspaces"

export type AppendBrainResult =
  | { ok: true; scope: "workspace" | "owner" }
  | { ok: false; reason: "no_scope" | "empty" }

export async function appendCareerOsMarkdownToJunoBrain(
  userId: string,
  markdown: string,
): Promise<AppendBrainResult> {
  const trimmed = markdown.trim()
  if (!trimmed) return { ok: false, reason: "empty" }

  const workspace = await resolveWorkspaceSelection(userId, {
    useCookieWorkspace: true,
  })
  const organization = workspace
    ? null
    : await resolveOrganizationSelection(userId, { useCookieOrganization: true })

  if (!workspace && !organization) {
    return { ok: false, reason: "no_scope" }
  }

  const table = workspace ? "client_workspace_profiles" : "company_profile"
  const selectQuery = workspace
    ? supabaseAdmin
        .from("client_workspace_profiles")
        .select("knowledge_base_md")
        .eq("owner_user_id", userId)
        .eq("workspace_id", workspace.id)
        .maybeSingle()
    : supabaseAdmin
        .from("company_profile")
        .select("knowledge_base_md")
        .eq("organization_id", organization!.id)
        .maybeSingle()

  const { data: row, error: readError } = await selectQuery
  if (readError) throw readError

  const previous =
    row && typeof (row as { knowledge_base_md?: unknown }).knowledge_base_md === "string"
      ? (row as { knowledge_base_md: string }).knowledge_base_md
      : ""

  const stamp = new Date().toISOString().slice(0, 10)
  const block = `\n\n---\n\n## CareerOS — LLM import (${stamp})\n\n${trimmed}\n`
  const nextKb = `${previous.trim()}${block}`.trim()

  const now = new Date().toISOString()
  const patch = workspace
    ? {
        owner_user_id: userId,
        workspace_id: workspace.id,
        knowledge_base_md: nextKb,
        knowledge_base_updated_at: now,
      }
    : {
        user_id: userId,
        organization_id: organization!.id,
        knowledge_base_md: nextKb,
        knowledge_base_updated_at: now,
      }

  const { error: upsertError } = await supabaseAdmin
    .from(table)
    .upsert(patch, {
      onConflict: workspace ? "workspace_id" : "organization_id",
    })

  if (upsertError) throw upsertError

  if (workspace) {
    const { data: wsRow } = await supabaseAdmin
      .from("client_workspace_profiles")
      .select("company_name")
      .eq("owner_user_id", userId)
      .eq("workspace_id", workspace.id)
      .maybeSingle()

    const companyName =
      wsRow && typeof (wsRow as { company_name?: unknown }).company_name === "string"
        ? (wsRow as { company_name: string }).company_name
        : null

    await supabaseAdmin
      .from("client_workspaces")
      .update({
        company_name: companyName?.trim() || null,
        context_status: companyName?.trim() ? "ready" : "intake_started",
        updated_at: now,
      })
      .eq("id", workspace.id)
      .eq("owner_user_id", userId)
  }

  return { ok: true, scope: workspace ? "workspace" : "owner" }
}

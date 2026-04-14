import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { supabaseAdmin } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationSelection } from "@/lib/organizations"
import { resolveWorkspaceSelection } from "@/lib/workspaces"

async function getWorkspaceForRequest(userId: string, request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get("scope") === "owner") return null
  return resolveWorkspaceSelection(userId, { useCookieWorkspace: true })
}

/**
 * Copies `vault_context_cache` into `knowledge_base_md` for the current scope
 * (team workspace cookie or personal org). Vault sync does not do this automatically;
 * Juno otherwise reads both fields as separate prompt sections.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const workspace = await getWorkspaceForRequest(user.id, request)
    const organization =
      workspace === null
        ? await resolveOrganizationSelection(user.id, { useCookieOrganization: true })
        : null

    if (!workspace && !organization) {
      return NextResponse.json({ error: "No active organization" }, { status: 400 })
    }

    const { data: row, error: loadErr } = workspace
      ? await supabaseAdmin
          .from("client_workspace_profiles")
          .select("vault_context_cache")
          .eq("owner_user_id", user.id)
          .eq("workspace_id", workspace.id)
          .maybeSingle()
      : await supabaseAdmin
          .from("company_profile")
          .select("vault_context_cache")
          .eq("organization_id", organization!.id)
          .maybeSingle()

    if (loadErr) {
      return jsonApiError(500, loadErr, "knowledge-from-vault load")
    }

    const cache = typeof row?.vault_context_cache === "string" ? row.vault_context_cache.trim() : ""
    if (!cache) {
      return NextResponse.json(
        {
          error:
            "No vault cache yet. Use Save + Sync on the vault first, then try again.",
        },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const table = workspace ? "client_workspace_profiles" : "company_profile"
    const patch: Record<string, unknown> = workspace
      ? {
          owner_user_id: user.id,
          workspace_id: workspace.id,
          knowledge_base_md: cache,
          knowledge_base_updated_at: now,
        }
      : {
          user_id: user.id,
          organization_id: organization!.id,
          knowledge_base_md: cache,
          knowledge_base_updated_at: now,
        }

    const { data: saved, error: saveErr } = await supabaseAdmin
      .from(table)
      .upsert(patch, { onConflict: workspace ? "workspace_id" : "organization_id" })
      .select()
      .single()

    if (saveErr) {
      return jsonApiError(500, saveErr, "knowledge-from-vault upsert")
    }

    if (workspace) {
      const r = saved as Record<string, unknown>
      const companyName = typeof r.company_name === "string" ? r.company_name : null
      await supabaseAdmin
        .from("client_workspaces")
        .update({
          company_name: companyName?.trim() || null,
          context_status: companyName?.trim() ? "ready" : "intake_started",
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspace.id)
        .eq("owner_user_id", user.id)
    }

    return NextResponse.json({
      ok: true,
      scope: workspace ? "workspace" : "owner",
      knowledge_base_updated_at: now,
      charCount: cache.length,
    })
  } catch (error) {
    return jsonApiError(500, error, "knowledge-from-vault POST")
  }
}

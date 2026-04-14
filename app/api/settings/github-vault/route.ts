import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { supabaseAdmin } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/server"
import { normalizeVaultFolders } from "@/lib/vault-context-shared"
import { syncVaultContextCacheForUser, syncVaultContextCacheForWorkspace } from "@/lib/vault-context-sync"
import { resolveOrganizationSelection } from "@/lib/organizations"
import { resolveWorkspaceSelection } from "@/lib/workspaces"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const workspace = await resolveWorkspaceSelection(user.id, { useCookieWorkspace: true })
    if (workspace) {
      const { data } = await supabaseAdmin
        .from("client_workspace_profiles")
        .select(
          "github_vault_repo, github_vault_branch, vault_folders, vault_context_last_synced_at, vault_context_file_count, vault_context_sync_error",
        )
        .eq("owner_user_id", user.id)
        .eq("workspace_id", workspace.id)
        .maybeSingle()

      return NextResponse.json({
        repo: data?.github_vault_repo ?? null,
        branch: data?.github_vault_branch ?? "main",
        folders: normalizeVaultFolders(data?.vault_folders),
        connected: Boolean(data?.github_vault_repo),
        lastSyncedAt: data?.vault_context_last_synced_at ?? null,
        fileCount: data?.vault_context_file_count ?? 0,
        syncError: data?.vault_context_sync_error ?? null,
        unsupported: false,
      })
    }

    const organization = await resolveOrganizationSelection(user.id, { useCookieOrganization: true })
    if (!organization) {
      return NextResponse.json({ error: "No active organization" }, { status: 400 })
    }

    const { data } = await supabase
      .from("company_profile")
      .select(
        "github_vault_repo, github_vault_branch, vault_folders, vault_context_last_synced_at, vault_context_file_count, vault_context_sync_error",
      )
      .eq("organization_id", organization.id)
      .maybeSingle()

    return NextResponse.json({
      repo: data?.github_vault_repo ?? null,
      branch: data?.github_vault_branch ?? "main",
      folders: normalizeVaultFolders(data?.vault_folders),
      connected: Boolean(data?.github_vault_repo),
      lastSyncedAt: data?.vault_context_last_synced_at ?? null,
      fileCount: data?.vault_context_file_count ?? 0,
      syncError: data?.vault_context_sync_error ?? null,
    })
  } catch (e) {
    console.error("github-vault GET:", e)
    return NextResponse.json({ error: "Failed to load" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      repo?: string | null
      branch?: string | null
      folders?: string[] | string | null
      sync?: boolean
    }

    const repo = typeof body.repo === "string" ? body.repo.trim() : ""
    const branch = typeof body.branch === "string" && body.branch.trim() ? body.branch.trim() : "main"
    const folders = normalizeVaultFolders(body.folders)

    const workspace = await resolveWorkspaceSelection(user.id, { useCookieWorkspace: true })
    if (workspace) {
      if (!repo) {
        const { error: clearErr } = await supabaseAdmin
          .from("client_workspace_profiles")
          .update({
            github_vault_owner: null,
            github_vault_repo: null,
            github_vault_branch: "main",
            github_vault_path: "",
            vault_folders: folders,
            vault_context_cache: null,
            vault_context_last_synced_at: null,
            vault_context_file_count: null,
            vault_context_sync_error: null,
          })
          .eq("workspace_id", workspace.id)
          .eq("owner_user_id", user.id)

        if (clearErr) {
          return jsonApiError(500, clearErr, "github-vault POST clear workspace vault")
        }

        return NextResponse.json({
          saved: true,
          cleared: true,
          repo: null,
          branch: "main",
          folders,
          connected: false,
          lastSyncedAt: null,
          fileCount: 0,
          syncError: null,
        })
      }

      const vaultPatch = {
        owner_user_id: user.id,
        workspace_id: workspace.id,
        github_vault_owner: null as string | null,
        github_vault_repo: repo,
        github_vault_branch: branch,
        github_vault_path: "",
        vault_folders: folders,
      }

      const { error: upsertErr } = await supabaseAdmin
        .from("client_workspace_profiles")
        .upsert(vaultPatch, { onConflict: "workspace_id" })

      if (upsertErr) {
        return jsonApiError(500, upsertErr, "github-vault POST upsert workspace vault")
      }

      if (body.sync === false) {
        return NextResponse.json({
          saved: true,
          cleared: false,
          repo,
          branch,
          folders,
          connected: true,
        })
      }

      const result = await syncVaultContextCacheForWorkspace(supabaseAdmin, user.id, workspace.id)
      return NextResponse.json({
        saved: true,
        cleared: false,
        repo,
        branch,
        folders,
        connected: result.connected,
        synced: result.ok,
        lastSyncedAt: result.lastSyncedAt,
        fileCount: result.fileCount,
        syncError: result.error ?? null,
        warning: result.warning ?? null,
      })
    }

    const organization = await resolveOrganizationSelection(user.id, { useCookieOrganization: true })
    if (!organization) {
      return NextResponse.json({ error: "No active organization" }, { status: 400 })
    }

    if (!repo) {
      const { error: clearErr } = await supabase
        .from("company_profile")
        .update({
          github_vault_owner: null,
          github_vault_repo: null,
          github_vault_branch: "main",
          github_vault_path: "",
          vault_folders: folders,
          vault_context_cache: null,
          vault_context_last_synced_at: null,
          vault_context_file_count: null,
          vault_context_sync_error: null,
        })
        .eq("organization_id", organization.id)

      if (clearErr) {
        return jsonApiError(500, clearErr, "github-vault POST clear vault fields")
      }

      return NextResponse.json({
        saved: true,
        cleared: true,
        repo: null,
        branch: "main",
        folders,
        connected: false,
        lastSyncedAt: null,
        fileCount: 0,
        syncError: null,
      })
    }

    const vaultPatch = {
      user_id: user.id,
      github_vault_owner: null as string | null,
      github_vault_repo: repo,
      github_vault_branch: branch,
      github_vault_path: "",
      vault_folders: folders,
    }

    const { data: updatedRow, error: updateErr } = await supabase
      .from("company_profile")
      .update(vaultPatch)
      .eq("organization_id", organization.id)
      .select("id")
      .maybeSingle()

    if (updateErr) {
      return jsonApiError(500, updateErr, "github-vault POST update vault fields")
    }

    if (!updatedRow) {
      const { error: insertErr } = await supabase.from("company_profile").insert({
        organization_id: organization.id,
        ...vaultPatch,
      })
      if (insertErr) {
        return jsonApiError(500, insertErr, "github-vault POST insert company_profile")
      }
    }

    if (body.sync === false) {
      return NextResponse.json({
        saved: true,
        cleared: false,
        repo,
        branch,
        folders,
        connected: true,
      })
    }

    const result = await syncVaultContextCacheForUser(supabase, user.id, organization.id)
    return NextResponse.json({
      saved: true,
      cleared: false,
      repo,
      branch,
      folders,
      connected: result.connected,
      synced: result.ok,
      lastSyncedAt: result.lastSyncedAt,
      fileCount: result.fileCount,
      syncError: result.error ?? null,
      warning: result.warning ?? null,
    })
  } catch (e) {
    console.error("github-vault POST:", e)
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { normalizeVaultFolders } from "@/lib/vault-context-shared"
import { syncVaultContextCacheForUser } from "@/lib/vault-context-sync"
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

    const workspace = await resolveWorkspaceSelection(user.id)
    if (workspace) {
      return NextResponse.json({
        repo: null,
        branch: "main",
        folders: [],
        connected: false,
        lastSyncedAt: null,
        fileCount: 0,
        syncError: null,
        unsupported: true,
      })
    }

    const { data } = await supabase
      .from("company_profile")
      .select(
        "github_vault_repo, github_vault_branch, vault_folders, vault_context_last_synced_at, vault_context_file_count, vault_context_sync_error",
      )
      .eq("user_id", user.id)
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

    const workspace = await resolveWorkspaceSelection(user.id)
    if (workspace) {
      return NextResponse.json(
        { error: "GitHub vault sync is only available on your primary workspace right now." },
        { status: 400 },
      )
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

    if (!repo) {
      const { error: clearErr } = await supabase.from("company_profile").upsert(
        {
          user_id: user.id,
          github_vault_owner: null,
          github_vault_repo: null,
          github_vault_branch: "main",
          github_vault_path: "",
          vault_folders: folders,
          vault_context_cache: null,
          vault_context_last_synced_at: null,
          vault_context_file_count: null,
          vault_context_sync_error: null,
        },
        { onConflict: "user_id" },
      )

      if (clearErr) {
        return jsonApiError(500, clearErr, "github-vault POST clear")
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

    const { error: upErr } = await supabase.from("company_profile").upsert(
      {
        user_id: user.id,
        github_vault_owner: null,
        github_vault_repo: repo,
        github_vault_branch: branch,
        github_vault_path: "",
        vault_folders: folders,
      },
      { onConflict: "user_id" },
    )

    if (upErr) {
      return jsonApiError(500, upErr, "github-vault POST upsert")
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

    const result = await syncVaultContextCacheForUser(supabase, user.id)
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

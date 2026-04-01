import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/server"
import { normalizeVaultFolders } from "@/lib/vault-context-shared"
import { resolveWorkspaceSelection } from "@/lib/workspaces"

function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key)
}

function normalizedText(value: unknown): string | null {
  if (typeof value !== "string") return value == null ? null : String(value)
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function getWorkspaceForRequest(userId: string, request: Request) {
  const url = new URL(request.url)
  const scope = url.searchParams.get("scope")
  if (scope === "owner") return null
  return resolveWorkspaceSelection(userId)
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ profile: null })
    }

    const workspace = await getWorkspaceForRequest(user.id, request)

    const { data: profile, error } = workspace
      ? await supabaseAdmin
          .from("client_workspace_profiles")
          .select("*")
          .eq("owner_user_id", user.id)
          .eq("workspace_id", workspace.id)
          .maybeSingle()
      : await supabaseAdmin
          .from("company_profile")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle()

    if (error && error.code !== "PGRST116") throw error

    return NextResponse.json({
      profile: profile ?? null,
      scope: workspace ? "workspace" : "owner",
      workspace: workspace ?? null,
    })
  } catch (error) {
    console.error("Company profile GET error:", error)
    return NextResponse.json({ profile: null }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const workspace = await getWorkspaceForRequest(user.id, request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const { data: existingRow } = workspace
      ? await supabaseAdmin
          .from("client_workspace_profiles")
          .select("knowledge_base_md, knowledge_base_updated_at")
          .eq("owner_user_id", user.id)
          .eq("workspace_id", workspace.id)
          .maybeSingle()
      : await supabaseAdmin
          .from("company_profile")
          .select("knowledge_base_md, knowledge_base_updated_at")
          .eq("user_id", user.id)
          .maybeSingle()

    const patch: Record<string, unknown> = workspace
      ? { owner_user_id: user.id, workspace_id: workspace.id }
      : { user_id: user.id }

    const passthroughFields = [
      "company_name",
      "tagline",
      "company_description",
      "problem",
      "solution",
      "target_market",
      "industry",
      "vertical",
      "stage",
      "traction",
      "team_summary",
      "funding_goal",
      "founder_name",
      "founder_location",
      "founder_background",
      "thesis",
      "business_model",
      "differentiators",
      "icp",
      "competitors",
      "keywords",
      "priorities",
      "risks",
      "jack_jill_jobs",
      "brand_voice",
      "brand_promise",
      "brand_never_say",
      "brand_proof_points",
      "brand_voice_dna",
      "brand_channel_voice",
      "brand_words_use",
      "brand_words_never",
      "brand_credibility_hooks",
      "github_repo",
      "github_branch",
    ] as const

    for (const field of passthroughFields) {
      if (!hasOwn(body, field)) continue
      patch[field] = body[field] ?? null
    }

    if (hasOwn(body, "knowledge_base_md")) {
      const nextKnowledgeBase = typeof body.knowledge_base_md === "string" ? body.knowledge_base_md : ""
      patch.knowledge_base_md = nextKnowledgeBase || null

      const previousKnowledgeBase = typeof existingRow?.knowledge_base_md === "string" ? existingRow.knowledge_base_md : ""
      if (nextKnowledgeBase !== previousKnowledgeBase) {
        patch.knowledge_base_updated_at = nextKnowledgeBase.trim() ? new Date().toISOString() : null
      }
    }

    if (hasOwn(body, "github_vault_repo")) {
      const repo = normalizedText(body.github_vault_repo)
      patch.github_vault_repo = repo
      patch.github_vault_owner = null
      patch.github_vault_path = ""

      if (!repo) {
        patch.github_vault_branch = "main"
        patch.vault_context_cache = null
        patch.vault_context_last_synced_at = null
        patch.vault_context_file_count = null
        patch.vault_context_sync_error = null
      }
    }

    if (hasOwn(body, "github_vault_branch")) {
      patch.github_vault_branch = normalizedText(body.github_vault_branch) ?? "main"
    }

    if (hasOwn(body, "vault_folders")) {
      patch.vault_folders = normalizeVaultFolders(body.vault_folders)
    }

    if (hasOwn(body, "vault_context_cache")) {
      patch.vault_context_cache = body.vault_context_cache ?? null
    }

    if (hasOwn(body, "vault_context_last_synced_at")) {
      patch.vault_context_last_synced_at = body.vault_context_last_synced_at ?? null
    }

    if (hasOwn(body, "vault_context_file_count")) {
      patch.vault_context_file_count = body.vault_context_file_count ?? null
    }

    if (hasOwn(body, "vault_context_sync_error")) {
      patch.vault_context_sync_error = body.vault_context_sync_error ?? null
    }

    const table = workspace ? "client_workspace_profiles" : "company_profile"
    const { data, error } = await supabaseAdmin
      .from(table)
      .upsert(patch, { onConflict: workspace ? "workspace_id" : "user_id" })
      .select()
      .single()

    if (error) throw error

    if (workspace) {
      const row = data as Record<string, unknown>
      const companyName = typeof row.company_name === "string" ? row.company_name : null
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
      profile: data,
      scope: workspace ? "workspace" : "owner",
      workspace: workspace ?? null,
    })
  } catch (error) {
    console.error("Company profile PUT error:", error)
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 })
  }
}

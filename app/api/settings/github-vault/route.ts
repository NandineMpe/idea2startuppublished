import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { fetchGithubVaultFromProfileFields } from "@/lib/github-vault"

/**
 * GET — current GitHub vault pointer (Obsidian → GitHub).
 * POST — save owner/repo/branch/path and optionally probe the API (returns file count).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data } = await supabase
      .from("company_profile")
      .select(
        "github_vault_owner, github_vault_repo, github_vault_branch, github_vault_path, github_vault_last_verified_at, github_vault_last_probe_file_count, github_vault_last_probe_error",
      )
      .eq("user_id", user.id)
      .maybeSingle()

    return NextResponse.json({
      owner: data?.github_vault_owner ?? null,
      repo: data?.github_vault_repo ?? null,
      branch: data?.github_vault_branch ?? "main",
      path: data?.github_vault_path ?? "",
      lastVerifiedAt: data?.github_vault_last_verified_at ?? null,
      lastProbeFileCount: data?.github_vault_last_probe_file_count ?? null,
      lastProbeError: data?.github_vault_last_probe_error ?? null,
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

    const body = await request.json().catch(() => ({})) as {
      owner?: string | null
      repo?: string | null
      branch?: string | null
      path?: string | null
      probe?: boolean
    }

    const owner = typeof body.owner === "string" ? body.owner.trim() : ""
    const repo = typeof body.repo === "string" ? body.repo.trim() : ""
    const branch = typeof body.branch === "string" && body.branch.trim() ? body.branch.trim() : "main"
    const pathVal = typeof body.path === "string" ? body.path.trim() : ""

    if (!owner || !repo) {
      const { error: clearErr } = await supabase.from("company_profile").upsert(
        {
          user_id: user.id,
          github_vault_owner: null,
          github_vault_repo: null,
          github_vault_branch: "main",
          github_vault_path: "",
          github_vault_last_verified_at: null,
          github_vault_last_probe_file_count: null,
          github_vault_last_probe_error: null,
        },
        { onConflict: "user_id" },
      )

      if (clearErr) {
        return jsonApiError(500, clearErr, "github-vault POST clear")
      }

      return NextResponse.json({
        saved: true,
        cleared: true,
        probe: { fileCount: 0, error: null as string | null },
      })
    }

    const { data: existing } = await supabase
      .from("company_profile")
      .select("github_vault_last_verified_at, github_vault_last_probe_file_count, github_vault_last_probe_error")
      .eq("user_id", user.id)
      .maybeSingle()

    const row = {
      github_vault_owner: owner,
      github_vault_repo: repo,
      github_vault_branch: branch,
      github_vault_path: pathVal,
    }

    let probe = { fileCount: 0, error: null as string | null, samplePaths: [] as string[] }
    if (body.probe !== false) {
      const result = await fetchGithubVaultFromProfileFields(row)
      probe = {
        fileCount: result.files.length,
        error: result.error ?? null,
        samplePaths: result.files.slice(0, 8).map((f) => f.path),
      }
    }

    const verifiedAt = new Date().toISOString()
    const { error: upErr } = await supabase.from("company_profile").upsert(
      {
        user_id: user.id,
        ...row,
        github_vault_last_verified_at:
          body.probe !== false ? verifiedAt : (existing?.github_vault_last_verified_at ?? null),
        github_vault_last_probe_file_count:
          body.probe !== false ? probe.fileCount : (existing?.github_vault_last_probe_file_count ?? null),
        github_vault_last_probe_error:
          body.probe !== false ? probe.error : (existing?.github_vault_last_probe_error ?? null),
      },
      { onConflict: "user_id" },
    )

    if (upErr) {
      return jsonApiError(500, upErr, "github-vault POST upsert")
    }

    return NextResponse.json({
      saved: true,
      probe,
      lastVerifiedAt: body.probe !== false ? verifiedAt : (existing?.github_vault_last_verified_at ?? null),
    })
  } catch (e) {
    console.error("github-vault POST:", e)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}

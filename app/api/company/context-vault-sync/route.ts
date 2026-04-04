import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationSelection } from "@/lib/organizations"
import { syncVaultContextCacheForUser } from "@/lib/vault-context-sync"

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organization = await resolveOrganizationSelection(user.id, { useCookieOrganization: true })
    if (!organization) {
      return NextResponse.json({ error: "No active organization" }, { status: 400 })
    }

    const result = await syncVaultContextCacheForUser(supabase, user.id, organization.id)

    if (!result.connected) {
      return NextResponse.json(
        {
          error: result.error ?? "Connect a GitHub-backed Obsidian vault first.",
        },
        { status: 400 },
      )
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error ?? "Vault sync failed.",
          fileCount: result.fileCount,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      repo: result.repo,
      branch: result.branch,
      folders: result.folders,
      fileCount: result.fileCount,
      lastSyncedAt: result.lastSyncedAt,
      warning: result.warning ?? null,
    })
  } catch (e) {
    console.error("context-vault-sync POST:", e)
    return NextResponse.json({ error: "Vault sync failed." }, { status: 500 })
  }
}

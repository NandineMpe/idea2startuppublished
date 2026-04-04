import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { supabaseAdmin } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/server"
import { saveVaultKnowledgeEntry } from "@/lib/vault-knowledge"
import { resolveOrganizationSelection } from "@/lib/organizations"
import { resolveWorkspaceSelection } from "@/lib/workspaces"

async function extractTextFromBuffer(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === "application/pdf") {
    const pdfParse = (await import("pdf-parse")) as unknown as (
      input: Buffer,
    ) => Promise<{ text?: string }>
    const data = await pdfParse(buffer)
    return data.text || ""
  }
  if (
    mimetype === "text/plain" ||
    mimetype === "text/markdown" ||
    mimetype === "text/html" ||
    mimetype === "text/csv"
  ) {
    return buffer.toString("utf-8")
  }
  return ""
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ assets: [] })
    }

    const workspace = await resolveWorkspaceSelection(user.id)
    const organization =
      workspace === null
        ? await resolveOrganizationSelection(user.id, { useCookieOrganization: true })
        : null

    const { data: assets, error } = workspace
      ? await supabaseAdmin
          .from("client_workspace_assets")
          .select("id, type, title, source_url, created_at")
          .eq("owner_user_id", user.id)
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false })
      : organization
        ? await supabase
            .from("company_assets")
            .select("id, type, title, source_url, created_at")
            .eq("organization_id", organization.id)
            .order("created_at", { ascending: false })
        : { data: [], error: null }

    if (error) throw error

    return NextResponse.json({
      assets: assets ?? [],
      scope: workspace ? "workspace" : "owner",
      workspace: workspace ?? null,
      organization: organization ?? null,
    })
  } catch (error) {
    console.error("Company assets GET error:", error)
    return NextResponse.json({ assets: [] }, { status: 500 })
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
    const organization =
      workspace === null
        ? await resolveOrganizationSelection(user.id, { useCookieOrganization: true })
        : null

    if (!workspace && !organization) {
      return NextResponse.json({ error: "No active organization" }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const type = (formData.get("type") as string) || "document"

    if (!file || !file.size) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const mimetype = file.type || "application/octet-stream"
    const filename = file.name || "document"

    const content = await extractTextFromBuffer(buffer, mimetype)

    if (!content.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from file. Supported: PDF, TXT, MD, HTML, CSV." },
        { status: 400 },
      )
    }

    const isPitchDeck = type === "pitch_deck"
    if (workspace) {
      if (isPitchDeck) {
        await supabaseAdmin
          .from("client_workspace_assets")
          .delete()
          .eq("owner_user_id", user.id)
          .eq("workspace_id", workspace.id)
          .eq("type", "pitch_deck")
      }

      const { data: asset, error } = await supabaseAdmin
        .from("client_workspace_assets")
        .insert({
          owner_user_id: user.id,
          workspace_id: workspace.id,
          type: isPitchDeck ? "pitch_deck" : "document",
          title: filename,
          content: content.slice(0, 100000),
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({
        success: true,
        asset,
        scope: "workspace",
        workspace,
        vaultPath: null,
      })
    }

    if (!organization) {
      return NextResponse.json({ error: "No active organization" }, { status: 400 })
    }

    const vaultWrite = await saveVaultKnowledgeEntry({
      content,
      title: filename,
      userId: user.id,
      path: isPitchDeck ? "sources/pitch-decks/current-pitch-deck.md" : undefined,
      folder: isPitchDeck ? "sources/pitch-decks" : "sources/documents",
      noteType: isPitchDeck ? "pitch_deck" : "source_document",
    })

    if (!vaultWrite.success) {
      return NextResponse.json(
        { error: vaultWrite.error ?? "Obsidian vault sync failed. Connect the vault before uploading documents." },
        { status: 500 },
      )
    }

    if (isPitchDeck) {
      await supabase
        .from("company_assets")
        .delete()
        .eq("organization_id", organization.id)
        .eq("type", "pitch_deck")
    }

    const { data: asset, error } = await supabase
      .from("company_assets")
      .insert({
        user_id: user.id,
        organization_id: organization.id,
        type: isPitchDeck ? "pitch_deck" : "document",
        title: filename,
        content: content.slice(0, 100000),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, asset, vaultPath: vaultWrite.path, scope: "owner" })
  } catch (error) {
    return jsonApiError(500, error, "company assets POST")
  }
}

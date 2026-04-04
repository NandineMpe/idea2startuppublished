import { NextResponse } from "next/server"
import { convert } from "html-to-text"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationSelection } from "@/lib/organizations"
import { saveVaultKnowledgeEntry } from "@/lib/vault-knowledge"

export async function POST(request: Request) {
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

    const { url } = await request.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    const trimmed = url.trim()
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    const res = await fetch(trimmed, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IdeaToStartup/1.0)" },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)

    const html = await res.text()
    const text = convert(html, {
      wordwrap: 130,
      selectors: [{ selector: "a", format: "inline" }],
    })

    const title = new URL(trimmed).hostname + " - " + trimmed.slice(0, 60)
    const vaultWrite = await saveVaultKnowledgeEntry({
      content: text,
      title,
      sourceUrl: trimmed,
      userId: user.id,
      folder: "sources/scrapes",
      noteType: "scraped_source",
    })

    if (!vaultWrite.success) {
      return NextResponse.json(
        { error: vaultWrite.error ?? "Obsidian vault sync failed. Connect the vault before saving scrapes." },
        { status: 500 },
      )
    }

    const { data: asset, error } = await supabase
      .from("company_assets")
      .insert({
        user_id: user.id,
        organization_id: organization.id,
        type: "scraped_url",
        title,
        source_url: trimmed,
        content: text.slice(0, 50000),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, asset, vaultPath: vaultWrite.path })
  } catch (error) {
    return jsonApiError(500, error, "company scrape POST")
  }
}

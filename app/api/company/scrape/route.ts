import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { addToMemory } from "@/lib/supermemory"
import { convert } from "html-to-text"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    const { data: asset, error } = await supabase
      .from("company_assets")
      .insert({
        user_id: user.id,
        type: "scraped_url",
        title,
        source_url: trimmed,
        content: text.slice(0, 50000),
      })
      .select()
      .single()

    if (error) throw error

    addToMemory(`Source: ${trimmed}\n\n${text.slice(0, 8000)}`, user.id).catch(() => {})

    return NextResponse.json({ success: true, asset })
  } catch (error) {
    return jsonApiError(500, error, "company scrape POST")
  }
}

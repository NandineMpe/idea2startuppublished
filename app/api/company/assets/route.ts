import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { addToMemory } from "@/lib/supermemory"

async function extractTextFromBuffer(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  if (mimetype === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default
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

    const { data: assets, error } = await supabase
      .from("company_assets")
      .select("id, type, title, source_url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ assets: assets ?? [] })
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

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const type = (formData.get("type") as string) || "document"

    if (!file || !file.size) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const mimetype = file.type || "application/octet-stream"
    const filename = file.name || "document"

    const content = await extractTextFromBuffer(buffer, mimetype, filename)

    if (!content.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from file. Supported: PDF, TXT, MD, HTML, CSV." },
        { status: 400 },
      )
    }

    const isPitchDeck = type === "pitch_deck"

    if (isPitchDeck) {
      await supabase.from("company_assets").delete().eq("user_id", user.id).eq("type", "pitch_deck")
    }

    const { data: asset, error } = await supabase
      .from("company_assets")
      .insert({
        user_id: user.id,
        type: isPitchDeck ? "pitch_deck" : "document",
        title: filename,
        content: content.slice(0, 100000),
      })
      .select()
      .single()

    if (error) throw error

    addToMemory(`Source: ${filename}\n\n${content.slice(0, 8000)}`, user.id).catch(() => {})

    return NextResponse.json({ success: true, asset })
  } catch (error) {
    return jsonApiError(500, error, "company assets POST")
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { saveVaultKnowledgeEntry } from "@/lib/vault-knowledge"

export async function POST(req: Request) {
  try {
    const { content, fileName } = await req.json()

    if (!content) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const structuredContent = `Source: ${fileName || "Uploaded Document"}\n\n${content}`
    const result = await saveVaultKnowledgeEntry({
      content: structuredContent,
      title: fileName || "Uploaded Document",
      userId: user?.id,
      folder: "sources/manual",
      noteType: "manual_import",
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Failed to store in vault" }, { status: 500 })
    }

    return NextResponse.json({ success: true, memoryId: result.path, path: result.path })
  } catch (error) {
    console.error("Save knowledge error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

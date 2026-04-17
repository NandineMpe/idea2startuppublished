import { NextResponse } from "next/server"
import {
  buildIntelligencePreviewPayload,
  getIntelligencePreviewShareBySlug,
} from "@/lib/intelligence-preview"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const share = await getIntelligencePreviewShareBySlug(slug)
  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const payload = await buildIntelligencePreviewPayload(share)
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    })
  } catch (err) {
    console.error("[preview/intelligence] build error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

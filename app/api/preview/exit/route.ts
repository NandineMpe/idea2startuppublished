/**
 * POST/GET /api/preview/exit
 *
 * Ends a preview session: signs the impersonated user out of Supabase,
 * clears the preview cookies, and sends the viewer back to /login.
 */

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { PREVIEW_LABEL_COOKIE, PREVIEW_MODE_COOKIE } from "@/lib/preview-mode"

export const dynamic = "force-dynamic"

async function clearPreview() {
  const supabase = await createClient()
  try {
    await supabase.auth.signOut()
  } catch (err) {
    console.error("[preview/exit] signOut failed:", err)
  }

  const cookieStore = await cookies()
  cookieStore.delete(PREVIEW_MODE_COOKIE)
  cookieStore.delete(PREVIEW_LABEL_COOKIE)
}

export async function GET(request: Request) {
  await clearPreview()
  return NextResponse.redirect(new URL("/login", request.url))
}

export async function POST() {
  await clearPreview()
  return NextResponse.json({ ok: true })
}

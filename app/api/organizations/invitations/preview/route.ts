import { NextResponse } from "next/server"
import { getInvitePreviewByToken } from "@/lib/organization-invites"

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim()
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 })
  }

  const preview = await getInvitePreviewByToken(token)
  if (!preview.ok) {
    return NextResponse.json({ error: preview.error }, { status: 404 })
  }

  return NextResponse.json({
    organizationName: preview.organizationName,
    email: preview.email,
    expired: preview.expired,
    accepted: preview.accepted,
  })
}

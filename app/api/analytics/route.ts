import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Get the user ID cookie or create a new one
  let userId = request.cookies.get("user_id")?.value
  const response = NextResponse.json({ success: true })

  if (!userId) {
    // Generate a unique user ID if one doesn't exist
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    response.cookies.set("user_id", userId, {
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
      path: "/",
      sameSite: "lax",
    })
  }

  return response
}

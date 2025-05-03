import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Get the pathname from the URL
  const pathname = request.nextUrl.pathname

  // Set or get the user ID cookie
  let userId = request.cookies.get("user_id")?.value
  const response = NextResponse.next()

  if (!userId) {
    // Generate a unique user ID if one doesn't exist
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    response.cookies.set("user_id", userId, {
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
      path: "/",
      sameSite: "lax",
    })
  }

  // We don't need to track API routes
  if (pathname.startsWith("/api/")) {
    return response
  }

  // We'll track page visits on the client side using the trackSectionVisit function
  // This middleware just ensures the user ID cookie is set

  return response
}

// Only run middleware on pages, not on API routes or static assets
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}

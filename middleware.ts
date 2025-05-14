import { authMiddleware } from "@clerk/nextjs"
import { NextResponse } from "next/server"

// This function runs before Clerk's auth middleware
function updateResponse(response) {
  // Add analytics cookie if needed
  const responseHeaders = new Headers(response.headers)
  responseHeaders.set("x-middleware-cache", "no-cache")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

// Export Clerk's auth middleware with our configuration
export default authMiddleware({
  // Public routes that don't require authentication
  publicRoutes: ["/", "/sign-in(.*)", "/sign-up(.*)", "/api/test-kv", "/api/feedback"],

  // Handle after auth logic
  afterAuth(auth, req, evt) {
    // Handle users who aren't authenticated
    if (!auth.userId && !auth.isPublicRoute) {
      const signInUrl = new URL("/sign-in", req.url)
      signInUrl.searchParams.set("redirect_url", req.url)
      return NextResponse.redirect(signInUrl)
    }

    // If the user is signed in and trying to access sign-in/sign-up pages, redirect them to dashboard
    if (auth.userId && (req.nextUrl.pathname.startsWith("/sign-in") || req.nextUrl.pathname.startsWith("/sign-up"))) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // Allow the request to continue
    return NextResponse.next()
  },
})

// Configure which routes use the middleware
export const config = {
  matcher: [
    // Match all routes except static files and api routes
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$).*)",
  ],
}

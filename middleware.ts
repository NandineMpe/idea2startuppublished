import { authMiddleware } from "@clerk/nextjs"
import { NextResponse } from "next/server"

// Create a custom middleware function that combines Clerk auth and our custom logic
export default authMiddleware({
  // Routes that can be accessed while signed out
  publicRoutes: ["/", "/sign-in", "/sign-up", "/api/test-kv", "/api/feedback"],

  // This function runs after Clerk's auth checks
  async afterAuth(auth, req) {
    // Create a response object that we can modify
    const response = NextResponse.next()

    // Handle user ID cookie for analytics (even for non-authenticated users)
    let userId = req.cookies.get("user_id")?.value

    if (!userId) {
      // Generate a unique user ID if one doesn't exist
      userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      response.cookies.set("user_id", userId, {
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
        path: "/",
        sameSite: "lax",
      })
    }

    // Handle users who aren't authenticated trying to access protected routes
    if (!auth.userId && !auth.isPublicRoute) {
      const signInUrl = new URL("/sign-in", req.url)
      signInUrl.searchParams.set("redirect_url", req.url)
      return Response.redirect(signInUrl)
    }

    // If the user is signed in and trying to access sign-in/sign-up pages, redirect them to dashboard
    if (auth.userId && (req.nextUrl.pathname === "/sign-in" || req.nextUrl.pathname === "/sign-up")) {
      return Response.redirect(new URL("/dashboard", req.url))
    }

    // Return the response with any modifications
    return response
  },
})

// Configure which routes use the middleware
export const config = {
  matcher: [
    // Match all routes except static files, api routes we want to exclude, etc.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
}

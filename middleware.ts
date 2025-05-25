import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// Update public routes to include sso-callback
const isPublicRoute = createRouteMatcher([
  "/",
  "/auth(.*)",
  "/sso-callback",
  "/api/webhook/clerk",
  "/api/test",
  "/api/chat/(.*)",
])

const isAuthRoute = createRouteMatcher(["/auth(.*)"])

export default clerkMiddleware((auth, req) => {
  const { userId } = auth()

  // If user is logged in and trying to access auth routes, redirect to dashboard
  if (userId && isAuthRoute(req)) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  // If user is not logged in and trying to access protected routes, redirect to auth
  if (!userId && !isPublicRoute(req)) {
    return NextResponse.redirect(new URL("/auth", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}

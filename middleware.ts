import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher(["/", "/auth(.*)", "/sso-callback", "/api/webhook/clerk", "/api/test"])

const isAuthRoute = createRouteMatcher(["/auth(.*)", "/sso-callback"])

export default clerkMiddleware((auth, req) => {
  const { userId } = auth()

  // If user is logged in and trying to access auth routes, redirect to dashboard
  if (userId && isAuthRoute(req) && !req.url.includes("sso-callback")) {
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

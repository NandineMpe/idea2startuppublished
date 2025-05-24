import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth/signin(.*)",
  "/auth/signup(.*)",
  "/auth/error(.*)",
  "/api/webhook/clerk",
  "/api/chat/(.*)",
])

const isAuthRoute = createRouteMatcher(["/auth/signin(.*)", "/auth/signup(.*)"])

export default clerkMiddleware((auth, req) => {
  const { userId } = auth()

  // If user is logged in and trying to access auth routes, redirect to dashboard
  if (userId && isAuthRoute(req)) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  // If user is not logged in and trying to access protected routes, redirect to sign in
  if (!userId && !isPublicRoute(req)) {
    return NextResponse.redirect(new URL("/auth/signin", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}

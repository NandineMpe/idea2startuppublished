import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const { nextUrl } = req
    const isLoggedIn = !!req.nextauth.token

    // Define protected routes
    const isProtectedRoute = nextUrl.pathname.startsWith("/dashboard")
    const isAuthRoute = nextUrl.pathname.startsWith("/auth")

    // Redirect to dashboard if accessing auth routes while logged in
    if (isAuthRoute && isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }

    // Allow access to protected routes if logged in
    if (isProtectedRoute && isLoggedIn) {
      return NextResponse.next()
    }

    // This will be handled by withAuth - redirect to sign-in if not authenticated
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // Allow access to auth pages and home page
        if (pathname.startsWith("/auth") || pathname === "/") {
          return true
        }

        // Require authentication for dashboard routes
        if (pathname.startsWith("/dashboard")) {
          return !!token
        }

        // Allow access to other routes
        return true
      },
    },
    pages: {
      signIn: "/auth/signin",
    },
  },
)

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}

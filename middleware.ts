import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const { nextUrl, nextauth } = req
    const isLoggedIn = !!nextauth.token

    // Define route types
    const isProtectedRoute = nextUrl.pathname.startsWith("/dashboard")
    const isAuthRoute = nextUrl.pathname.startsWith("/auth")

    // Redirect authenticated users away from auth pages
    if (isAuthRoute && isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // Only require authentication for dashboard routes
        if (pathname.startsWith("/dashboard")) {
          return !!token
        }

        // Allow access to all other routes
        return true
      },
    },
    pages: {
      signIn: "/auth/signin",
    },
  },
)

export const config = {
  // Skip API routes, static files, and images
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}

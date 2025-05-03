import { authMiddleware } from "@clerk/nextjs"

export default authMiddleware({
  // Routes that can be accessed while signed out
  publicRoutes: ["/", "/sign-in", "/sign-up"],

  // Routes that can always be accessed, and have
  // no authentication information
  ignoredRoutes: ["/api/public"],

  // Ensure that users are redirected to the dashboard after sign-in
  afterAuth(auth, req) {
    // Handle users who aren't authenticated
    if (!auth.userId && !auth.isPublicRoute) {
      const signInUrl = new URL("/sign-in", req.url)
      signInUrl.searchParams.set("redirect_url", req.url)
      return Response.redirect(signInUrl)
    }

    // If the user is signed in and trying to access sign-in/sign-up pages, redirect them to dashboard
    if (auth.userId && (req.nextUrl.pathname === "/sign-in" || req.nextUrl.pathname === "/sign-up")) {
      return Response.redirect(new URL("/dashboard", req.url))
    }
  },
})

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}

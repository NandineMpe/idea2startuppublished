import { authMiddleware } from "@clerk/nextjs"

export default authMiddleware({
  // Public routes that don't require authentication
  publicRoutes: [
    "/",
    "/auth/signin",
    "/auth/signup",
    "/api/webhook/clerk",
    "/api/chat/deepseek(.*)",
    "/api/chat/gemini(.*)",
  ],

  // Routes that can be accessed without authentication
  // but still have access to the auth state
  ignoredRoutes: ["/api/webhook/clerk"],
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}

"use client"

import { createAuthClient } from "better-auth/react"
import { resolveAppUrl } from "@/lib/app-url"

/** Better Auth validates baseURL with `new URL()`; relative paths throw in production. */
function resolveBetterAuthClientBaseURL(): string {
  if (typeof window !== "undefined") {
    return new URL("/api/auth", window.location.origin).href
  }
  return new URL("/api/auth", resolveAppUrl()).href
}

export const authClient = createAuthClient({
  baseURL: resolveBetterAuthClientBaseURL(),
})
